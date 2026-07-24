from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ..database import get_db
from ..models import FeedingPlan, Batch
from ..schemas import (
    FeedingPlanCreate, FeedingPlanUpdate, FeedingPlanResponse,
    FeedingDeviationAlert,
)
from ..services import feeding_plan as feeding_plan_service

router = APIRouter(
    prefix="/api/feeding-plans",
    tags=["投喂计划"]
)

@router.post("/", response_model=FeedingPlanResponse)
def create_feeding_plan(plan: FeedingPlanCreate, db: Session = Depends(get_db)):
    db_batch = db.query(Batch).filter(Batch.id == plan.batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if db_batch.status != "active":
        raise HTTPException(status_code=400, detail="只有养殖中(active)的批次才能建立投喂计划")
    if plan.planned_quantity <= 0:
        raise HTTPException(status_code=400, detail="计划投喂量必须大于0")

    new_plan = FeedingPlan(**plan.dict())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan

@router.get("/", response_model=List[FeedingPlanResponse])
def get_feeding_plans(
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    plan_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = db.query(FeedingPlan)
    if batch_id:
        query = query.filter(FeedingPlan.batch_id == batch_id)
    if plan_date:
        query = query.filter(FeedingPlan.plan_date == plan_date)
    return query.offset(skip).limit(limit).all()

@router.get("/alerts/", response_model=List[FeedingDeviationAlert])
def get_feeding_deviation_alerts(
    batch_id: Optional[int] = None,
    plan_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    return feeding_plan_service.collect_alerts(db, batch_id=batch_id, plan_date=plan_date)

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
    if "batch_id" in update_data:
        db_batch = db.query(Batch).filter(Batch.id == update_data["batch_id"]).first()
        if not db_batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        if db_batch.status != "active":
            raise HTTPException(status_code=400, detail="只有养殖中(active)的批次才能建立投喂计划")
    if "planned_quantity" in update_data and update_data["planned_quantity"] is not None \
            and update_data["planned_quantity"] <= 0:
        raise HTTPException(status_code=400, detail="计划投喂量必须大于0")

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
