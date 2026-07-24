import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, Calendar } from 'lucide-react';
import { feedingPlanApi, batchApi } from '../services/api';
import type { FeedingPlan, Batch, FeedingDeviationAlert } from '../types';

const FeedingPlans: React.FC = () => {
  const [plans, setPlans] = useState<FeedingPlan[]>([]);
  const [alerts, setAlerts] = useState<FeedingDeviationAlert[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FeedingPlan | null>(null);
  const [filterBatchId, setFilterBatchId] = useState<string>('');
  const [formData, setFormData] = useState({
    batch_id: '',
    plan_date: '',
    planned_quantity: '',
    notes: ''
  });

  const activeBatches = batches.filter(b => b.status === 'active');

  const fetchData = async () => {
    try {
      const params: { batch_id?: number } = {};
      if (filterBatchId) {
        params.batch_id = parseInt(filterBatchId);
      }
      const [plansRes, batchesRes, alertsRes] = await Promise.all([
        feedingPlanApi.getAll(Object.keys(params).length > 0 ? params : undefined),
        batchApi.getAll(),
        feedingPlanApi.getAlerts({ alerts_only: false })
      ]);
      setPlans(plansRes.data);
      setBatches(batchesRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterBatchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(formData.planned_quantity);
    if (isNaN(qty) || qty <= 0) {
      alert('计划投喂量必须大于0公斤');
      return;
    }
    try {
      const data = {
        batch_id: parseInt(formData.batch_id),
        plan_date: formData.plan_date,
        planned_quantity: qty,
        notes: formData.notes || undefined
      };

      if (editingPlan) {
        await feedingPlanApi.update(editingPlan.id, data);
      } else {
        await feedingPlanApi.create(data);
      }

      setShowModal(false);
      setEditingPlan(null);
      setFormData({
        batch_id: '',
        plan_date: '',
        planned_quantity: '',
        notes: ''
      });
      fetchData();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      if (detail) {
        alert(detail);
      } else {
        console.error('Error saving plan:', error);
      }
    }
  };

  const handleEdit = (plan: FeedingPlan) => {
    setEditingPlan(plan);
    setFormData({
      batch_id: plan.batch_id.toString(),
      plan_date: plan.plan_date,
      planned_quantity: plan.planned_quantity.toString(),
      notes: plan.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('确定要删除这条投喂计划吗？')) {
      try {
        await feedingPlanApi.delete(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting plan:', error);
      }
    }
  };

  const getBatchNumber = (batchId: number) => {
    const batch = batches.find(b => b.id === batchId);
    return batch ? batch.batch_number : '未知批次';
  };

  const getAlertForPlan = (plan: FeedingPlan): FeedingDeviationAlert | undefined => {
    return alerts.find(a => a.plan_id === plan.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">投喂计划</h1>
          <p className="text-gray-600 mt-1">登记每日投喂计划量，与实际投喂对比，偏差超20%自动预警</p>
        </div>
        <button
          onClick={() => {
            setEditingPlan(null);
            setFormData({
              batch_id: '',
              plan_date: '',
              planned_quantity: '',
              notes: ''
            });
            setShowModal(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>新增计划</span>
        </button>
      </div>

      {alerts.filter(a => a.is_alert).length > 0 && (
        <div className="card bg-red-50 border border-red-200">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="text-red-600" size={20} />
            <h3 className="font-semibold text-red-800">投喂偏差预警 ({alerts.filter(a => a.is_alert).length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-red-700">
                  <th className="text-left py-2 px-3">批次号</th>
                  <th className="text-left py-2 px-3">日期</th>
                  <th className="text-right py-2 px-3">计划量(kg)</th>
                  <th className="text-right py-2 px-3">实际量(kg)</th>
                  <th className="text-right py-2 px-3">偏差</th>
                </tr>
              </thead>
              <tbody>
                {alerts.filter(a => a.is_alert).map((alert) => (
                  <tr key={alert.plan_id} className="border-t border-red-100">
                    <td className="py-2 px-3 font-medium text-red-800">{alert.batch_number}</td>
                    <td className="py-2 px-3">{alert.plan_date}</td>
                    <td className="py-2 px-3 text-right">{alert.planned_quantity.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right">{alert.actual_quantity.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-red-700">
                      {alert.deviation_percent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <Calendar size={18} className="text-gray-500" />
            <label className="text-sm font-medium text-gray-700">按批次筛选:</label>
          </div>
          <select
            value={filterBatchId}
            onChange={(e) => setFilterBatchId(e.target.value)}
            className="select-field w-64"
          >
            <option value="">全部批次</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batch_number} - {batch.species}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>批次号</th>
                <th>计划日期</th>
                <th>计划投喂量(公斤)</th>
                <th>偏差状态</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const alert = getAlertForPlan(plan);
                return (
                  <tr key={plan.id}>
                    <td className="font-medium text-ocean-700">{getBatchNumber(plan.batch_id)}</td>
                    <td>{plan.plan_date}</td>
                    <td>{plan.planned_quantity.toFixed(2)}</td>
                    <td>
                      {alert ? (
                        alert.is_pending ? (
                          <span className="badge badge-info">待执行</span>
                        ) : alert.is_alert ? (
                          <span className="badge badge-danger flex items-center space-x-1 w-fit">
                            <AlertTriangle size={12} />
                            <span>偏差 {alert.deviation_percent.toFixed(1)}%</span>
                          </span>
                        ) : (
                          <span className="badge badge-success">正常</span>
                        )
                      ) : (
                        <span className="text-gray-400 text-sm">暂无投喂记录</span>
                      )}
                    </td>
                    <td className="text-gray-600 text-sm max-w-[200px] truncate">{plan.notes || '-'}</td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(plan)}
                          className="p-2 text-ocean-600 hover:bg-ocean-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    暂无投喂计划
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPlan ? '编辑投喂计划' : '新增投喂计划'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  养殖批次 <span className="text-red-500">*</span>
                  <span className="text-gray-400 ml-2 text-xs">(仅进行中批次可选)</span>
                </label>
                <select
                  required
                  value={formData.batch_id}
                  onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                  className="select-field"
                >
                  <option value="">请选择批次</option>
                  {activeBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} - {batch.species}
                    </option>
                  ))}
                </select>
                {activeBatches.length === 0 && (
                  <p className="text-sm text-amber-600 mt-1">暂无进行中的批次，请先在批次管理中创建</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    计划日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.plan_date}
                    onChange={(e) => setFormData({ ...formData, plan_date: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    计划投喂量(公斤) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.planned_quantity}
                    onChange={(e) => setFormData({ ...formData, planned_quantity: e.target.value })}
                    className="input-field"
                    placeholder="计划投喂量(必须大于0)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="备注信息"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  {editingPlan ? '保存修改' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedingPlans;
