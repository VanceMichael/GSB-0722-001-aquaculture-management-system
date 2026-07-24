from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models

ALERT_THRESHOLD_PCT = 20.0


def sum_actual_feed_for_day(db: Session, batch_id: int, target_date: date) -> float:
    total = (
        db.query(func.coalesce(func.sum(models.FeedingRecord.feed_quantity), 0.0))
        .filter(
            models.FeedingRecord.batch_id == batch_id,
            models.FeedingRecord.feeding_date == target_date,
        )
        .scalar()
    )
    return float(total) if total is not None else 0.0


def _build_alert(plan: models.FeedingPlan, actual_kg: float, today: date) -> dict:
    planned = float(plan.planned_quantity_kg) if plan.planned_quantity_kg else 0.0
    deviation_pct: Optional[float] = None
    is_alert = False

    if planned > 0:
        deviation_pct = round((actual_kg - planned) / planned * 100.0, 2)
        if plan.plan_date <= today:
            is_alert = abs(deviation_pct) > ALERT_THRESHOLD_PCT

    return {
        "plan_id": plan.id,
        "batch_id": plan.batch_id,
        "plan_date": plan.plan_date,
        "planned_quantity_kg": planned,
        "actual_quantity_kg": round(actual_kg, 2),
        "deviation_pct": deviation_pct,
        "is_alert": is_alert,
        "notes": plan.notes,
    }


def evaluate_alerts(
    db: Session,
    batch_id: Optional[int] = None,
    target_date: Optional[date] = None,
    only_alerts: bool = True,
    skip: int = 0,
    limit: int = 100,
) -> List[dict]:
    today = date.today()

    query = db.query(models.FeedingPlan)
    if batch_id is not None:
        query = query.filter(models.FeedingPlan.batch_id == batch_id)
    if target_date is not None:
        query = query.filter(models.FeedingPlan.plan_date == target_date)

    plans = (
        query.order_by(models.FeedingPlan.plan_date.desc(), models.FeedingPlan.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results: List[dict] = []
    for plan in plans:
        actual_kg = sum_actual_feed_for_day(db, plan.batch_id, plan.plan_date)
        info = _build_alert(plan, actual_kg, today)
        if only_alerts and not info["is_alert"]:
            continue
        results.append(info)
    return results


def build_alert_for_plan(db: Session, plan: models.FeedingPlan) -> dict:
    today = date.today()
    actual_kg = sum_actual_feed_for_day(db, plan.batch_id, plan.plan_date)
    return _build_alert(plan, actual_kg, today)


def ensure_batch_active(db: Session, batch_id: int) -> models.Batch:
    batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if batch is None:
        raise ValueError("批次不存在")
    if batch.status != "active":
        raise ValueError("只有 active 状态的批次才能登记投喂计划")
    return batch


def plan_exists_for_batch_date(
    db: Session, batch_id: int, target_date: date, exclude_plan_id: Optional[int] = None
) -> bool:
    query = db.query(models.FeedingPlan).filter(
        models.FeedingPlan.batch_id == batch_id,
        models.FeedingPlan.plan_date == target_date,
    )
    if exclude_plan_id is not None:
        query = query.filter(models.FeedingPlan.id != exclude_plan_id)
    return query.first() is not None
