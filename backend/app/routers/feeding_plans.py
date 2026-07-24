from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..schemas import (
    FeedingPlanCreate,
    FeedingPlanUpdate,
    FeedingPlanResponse,
    FeedingAlert,
)
from ..services import feeding as feeding_service

router = APIRouter(
    prefix="/api/feeding-plans",
    tags=["投喂计划"],
)


@router.get("/alerts/", response_model=List[FeedingAlert])
def list_alerts(
    batch_id: Optional[int] = None,
    plan_date: Optional[date] = None,
    only_alerts: bool = True,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return feeding_service.evaluate_alerts(
        db,
        batch_id=batch_id,
        target_date=plan_date,
        only_alerts=only_alerts,
        skip=skip,
        limit=limit,
    )


@router.post("/", response_model=FeedingPlanResponse, status_code=201)
def create_plan(plan: FeedingPlanCreate, db: Session = Depends(get_db)):
    try:
        feeding_service.ensure_batch_active(db, plan.batch_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if plan.planned_quantity_kg <= 0:
        raise HTTPException(status_code=400, detail="计划投喂量必须大于 0 公斤")

    if feeding_service.plan_exists_for_batch_date(db, plan.batch_id, plan.plan_date):
        raise HTTPException(status_code=400, detail="该批次在该日期已存在投喂计划")

    db_plan = models.FeedingPlan(**plan.dict())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.get("/", response_model=List[FeedingPlanResponse])
def list_plans(
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    plan_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.FeedingPlan)
    if batch_id is not None:
        query = query.filter(models.FeedingPlan.batch_id == batch_id)
    if plan_date is not None:
        query = query.filter(models.FeedingPlan.plan_date == plan_date)
    return (
        query.order_by(models.FeedingPlan.plan_date.desc(), models.FeedingPlan.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{plan_id}/", response_model=FeedingPlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.FeedingPlan).filter(models.FeedingPlan.id == plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="投喂计划不存在")
    return plan


@router.get("/{plan_id}/alert/", response_model=FeedingAlert)
def get_plan_alert(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.FeedingPlan).filter(models.FeedingPlan.id == plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="投喂计划不存在")
    return feeding_service.build_alert_for_plan(db, plan)


@router.put("/{plan_id}/", response_model=FeedingPlanResponse)
def update_plan(plan_id: int, payload: FeedingPlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(models.FeedingPlan).filter(models.FeedingPlan.id == plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="投喂计划不存在")

    update_data = payload.dict(exclude_unset=True)

    target_batch_id = update_data.get("batch_id", plan.batch_id)
    target_plan_date = update_data.get("plan_date", plan.plan_date)

    if "batch_id" in update_data or "plan_date" in update_data:
        try:
            feeding_service.ensure_batch_active(db, target_batch_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        if feeding_service.plan_exists_for_batch_date(
            db, target_batch_id, target_plan_date, exclude_plan_id=plan_id
        ):
            raise HTTPException(status_code=400, detail="该批次在该日期已存在投喂计划")

    if "planned_quantity_kg" in update_data and update_data["planned_quantity_kg"] <= 0:
        raise HTTPException(status_code=400, detail="计划投喂量必须大于 0 公斤")

    for key, value in update_data.items():
        setattr(plan, key, value)

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}/")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.FeedingPlan).filter(models.FeedingPlan.id == plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="投喂计划不存在")
    db.delete(plan)
    db.commit()
    return {"message": "投喂计划删除成功"}
