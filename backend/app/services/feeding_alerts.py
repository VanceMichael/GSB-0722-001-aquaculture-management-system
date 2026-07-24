from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from ..models import FeedingPlan, FeedingRecord, Batch
from ..schemas import FeedingDeviationAlert

DEVIATION_THRESHOLD = 0.20


def compute_deviation_alerts(
    db: Session,
    batch_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    alerts_only: bool = False,
) -> List[FeedingDeviationAlert]:
    today = date.today()

    query = db.query(FeedingPlan)
    if batch_id is not None:
        query = query.filter(FeedingPlan.batch_id == batch_id)
    if start_date is not None:
        query = query.filter(FeedingPlan.plan_date >= start_date)
    if end_date is not None:
        query = query.filter(FeedingPlan.plan_date <= end_date)

    plans = query.order_by(FeedingPlan.plan_date.desc()).all()
    results: List[FeedingDeviationAlert] = []

    for plan in plans:
        batch = db.query(Batch).filter(Batch.id == plan.batch_id).first()
        batch_number = batch.batch_number if batch else ""

        is_future = plan.plan_date > today

        if is_future:
            if alerts_only:
                continue
            results.append(
                FeedingDeviationAlert(
                    plan_id=plan.id,
                    batch_id=plan.batch_id,
                    batch_number=batch_number,
                    plan_date=plan.plan_date,
                    planned_quantity=plan.planned_quantity,
                    actual_quantity=0.0,
                    deviation_amount=0.0,
                    deviation_percent=0.0,
                    is_alert=False,
                    is_pending=True,
                )
            )
            continue

        actual_sum = (
            db.query(func.coalesce(func.sum(FeedingRecord.feed_quantity), 0.0))
            .filter(
                FeedingRecord.batch_id == plan.batch_id,
                FeedingRecord.feeding_date == plan.plan_date,
            )
            .scalar()
        )

        planned = plan.planned_quantity
        deviation_amount = actual_sum - planned
        if planned > 0:
            deviation_percent = abs(deviation_amount) / planned
        else:
            deviation_percent = 1.0 if actual_sum > 0 else 0.0

        is_alert = deviation_percent > DEVIATION_THRESHOLD

        if alerts_only and not is_alert:
            continue

        results.append(
            FeedingDeviationAlert(
                plan_id=plan.id,
                batch_id=plan.batch_id,
                batch_number=batch_number,
                plan_date=plan.plan_date,
                planned_quantity=planned,
                actual_quantity=actual_sum,
                deviation_amount=deviation_amount,
                deviation_percent=round(deviation_percent * 100, 2),
                is_alert=is_alert,
                is_pending=False,
            )
        )

    return results


def validate_active_batch(db: Session, batch_id: int) -> bool:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        return False
    return batch.status == "active"
