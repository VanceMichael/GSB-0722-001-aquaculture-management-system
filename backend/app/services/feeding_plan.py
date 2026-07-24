"""投喂计划偏差预警业务规则。

该模块只负责纯业务计算：给定某批次某天的计划投喂量与当天已录入的实际
投喂量，判断偏差是否超过阈值并生成预警数据。它不依赖 FastAPI，也不直接
读写数据库连接之外的东西，方便单独测试与复用。路由层负责收发请求并把
ORM 查询结果传进来。
"""
from datetime import date
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import Batch, FeedingPlan, FeedingRecord

# 偏差阈值：实际投喂量相对计划量的偏差超过 20% 触发预警
DEVIATION_THRESHOLD = 0.20


def actual_quantity_for(db: Session, batch_id: int, plan_date: date) -> float:
    """汇总某批次某天已录入的实际投喂量（公斤）。

    只做读取聚合，绝不修改任何实际投喂记录。
    """
    total = db.query(func.sum(FeedingRecord.feed_quantity)).filter(
        FeedingRecord.batch_id == batch_id,
        FeedingRecord.feeding_date == plan_date,
    ).scalar()
    return float(total or 0.0)


def evaluate_plan(db: Session, plan: FeedingPlan, today: Optional[date] = None) -> Optional[dict]:
    """比较单条计划与当天实际投喂量，超阈值时返回预警数据，否则返回 None。

    未到计划日期的计划不参与评估：此时实绩尚未产生，实际量为 0 属正常，
    不应被提前标成投喂不足。
    """
    if today is None:
        today = date.today()

    # 计划日期在未来，实绩尚未到录入时点，跳过评估
    if plan.plan_date > today:
        return None

    planned = float(plan.planned_quantity or 0.0)
    actual = actual_quantity_for(db, plan.batch_id, plan.plan_date)

    # 计划量为 0 或负数无法计算比例，视为无有效计划，不产生预警
    if planned <= 0:
        return None

    deviation = actual - planned
    deviation_ratio = abs(deviation) / planned

    if deviation_ratio <= DEVIATION_THRESHOLD:
        return None

    batch = db.query(Batch).filter(Batch.id == plan.batch_id).first()

    return {
        "batch_id": plan.batch_id,
        "batch_number": batch.batch_number if batch else "未知批次",
        "plan_date": plan.plan_date,
        "planned_quantity": round(planned, 2),
        "actual_quantity": round(actual, 2),
        "deviation": round(deviation, 2),
        "deviation_ratio": round(deviation_ratio, 4),
        "threshold": DEVIATION_THRESHOLD,
        "direction": "over" if deviation > 0 else "under",
    }


def collect_alerts(
    db: Session,
    batch_id: Optional[int] = None,
    plan_date: Optional[date] = None,
) -> List[dict]:
    """扫描计划并返回所有超阈值的预警，可按批次和日期过滤。"""
    today = date.today()
    query = db.query(FeedingPlan)
    if batch_id is not None:
        query = query.filter(FeedingPlan.batch_id == batch_id)
    if plan_date is not None:
        query = query.filter(FeedingPlan.plan_date == plan_date)

    alerts = []
    for plan in query.all():
        alert = evaluate_plan(db, plan, today=today)
        if alert is not None:
            alerts.append(alert)
    return alerts
