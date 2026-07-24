from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ..database import get_db
from ..models import FeedingPlan, Batch
from ..schemas import (
    FeedingPlanCreate,
    FeedingPlanUpdate,
    FeedingPlanResponse,
    FeedingDeviationAlert,
)
from ..services.feeding_alerts import compute_deviation_alerts, validate_active_batch

router = APIRouter(
    prefix="/api/feeding-plans",
    tags=["投喂计划"]
)


@router.post("/", response_model=FeedingPlanResponse)
def create_feeding_plan(plan: FeedingPlanCreate, db: Session = Depends(get_db)):
    if plan.planned_quantity <= 0:
        raise HTTPException(status_code=400, detail="计划投喂量必须大于0公斤")

    db_batch = db.query(Batch).filter(Batch.id == plan.batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not validate_active_batch(db, plan.batch_id):
        raise HTTPException(status_code=400, detail="只有进行中(active)的批次才能创建投喂计划")

    existing = (
        db.query(FeedingPlan)
        .filter(
            FeedingPlan.batch_id == plan.batch_id,
            FeedingPlan.plan_date == plan.plan_date,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="该批次当天已存在投喂计划")

    db_plan = FeedingPlan(**plan.dict())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.get("/", response_model=List[FeedingPlanResponse])
def get_feeding_plans(
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    plan_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = db.query(FeedingPlan)
    if batch_id is not None:
        query = query.filter(FeedingPlan.batch_id == batch_id)
    if plan_date is not None:
        query = query.filter(FeedingPlan.plan_date == plan_date)
    plans = query.order_by(FeedingPlan.plan_date.desc()).offset(skip).limit(limit).all()
    return plans


@router.get("/alerts/", response_model=List[FeedingDeviationAlert])
def get_deviation_alerts(
    batch_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    alerts_only: bool = Query(default=True, description="是否只返回偏差超过20%的预警"),
    db: Session = Depends(get_db),
):
    return compute_deviation_alerts(
        db,
        batch_id=batch_id,
        start_date=start_date,
        end_date=end_date,
        alerts_only=alerts_only,
    )


@router.get("/{plan_id}/", response_model=FeedingPlanResponse)
def get_feeding_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(FeedingPlan).filter(FeedingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="投喂计划不存在")
    return plan


@router.put("/{plan_id}/", response_model=FeedingPlanResponse)
def update_feeding_plan(plan_id: int, plan: FeedingPlanUpdate, db: Session = Depends(get_db)):
    db_plan = db.query(FeedingPlan).filter(FeedingPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="投喂计划不存在")

    update_data = plan.dict(exclude_unset=True)

    if "planned_quantity" in update_data and update_data["planned_quantity"] is not None:
        if update_data["planned_quantity"] <= 0:
            raise HTTPException(status_code=400, detail="计划投喂量必须大于0公斤")

    target_batch_id = update_data.get("batch_id", db_plan.batch_id)
    db_batch = db.query(Batch).filter(Batch.id == target_batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not validate_active_batch(db, target_batch_id):
        raise HTTPException(status_code=400, detail="只有进行中(active)的批次才能修改投喂计划")

    target_date = update_data.get("plan_date", db_plan.plan_date)
    if "plan_date" in update_data or "batch_id" in update_data:
        dup = (
            db.query(FeedingPlan)
            .filter(
                FeedingPlan.batch_id == target_batch_id,
                FeedingPlan.plan_date == target_date,
                FeedingPlan.id != plan_id,
            )
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="该批次当天已存在投喂计划")

    for key, value in update_data.items():
        setattr(db_plan, key, value)

    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.delete("/{plan_id}/")
def delete_feeding_plan(plan_id: int, db: Session = Depends(get_db)):
    db_plan = db.query(FeedingPlan).filter(FeedingPlan.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="投喂计划不存在")

    db.delete(db_plan)
    db.commit()
    return {"message": "投喂计划删除成功"}
