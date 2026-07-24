import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, Calendar, ListChecks } from 'lucide-react';
import { feedingRecordApi, feedingPlanApi, batchApi } from '../services/api';
import type { FeedingRecord, FeedingPlan, FeedingAlert, Batch } from '../types';

type TabKey = 'records' | 'plans' | 'alerts';

const emptyRecordForm = {
  batch_id: '',
  feeding_date: '',
  feed_type: '',
  feed_quantity: '',
  feeding_time: '',
  weather: '',
  water_temperature: '',
  notes: '',
};

const emptyPlanForm = {
  batch_id: '',
  plan_date: '',
  planned_quantity_kg: '',
  notes: '',
};

const FeedingRecords: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('records');
  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [plans, setPlans] = useState<FeedingPlan[]>([]);
  const [alerts, setAlerts] = useState<FeedingAlert[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterBatchId, setFilterBatchId] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FeedingRecord | null>(null);
  const [recordForm, setRecordForm] = useState(emptyRecordForm);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FeedingPlan | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [planFormError, setPlanFormError] = useState<string>('');

  const activeBatches = batches.filter((b) => b.status === 'active');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const batchIdNum = filterBatchId ? parseInt(filterBatchId, 10) : undefined;
      const recordParams: { batch_id?: number; feeding_date?: string } = {};
      if (batchIdNum) recordParams.batch_id = batchIdNum;
      if (filterDate) recordParams.feeding_date = filterDate;

      const planParams: { batch_id?: number; plan_date?: string } = {};
      if (batchIdNum) planParams.batch_id = batchIdNum;
      if (filterDate) planParams.plan_date = filterDate;

      const alertParams: { batch_id?: number; plan_date?: string; only_alerts?: boolean } = {
        only_alerts: true,
      };
      if (batchIdNum) alertParams.batch_id = batchIdNum;
      if (filterDate) alertParams.plan_date = filterDate;

      const [recordsRes, plansRes, alertsRes, batchesRes] = await Promise.all([
        feedingRecordApi.getAll(recordParams),
        feedingPlanApi.getAll(planParams),
        feedingPlanApi.getAlerts(alertParams),
        batchApi.getAll(),
      ]);
      setRecords(recordsRes.data);
      setPlans(plansRes.data);
      setAlerts(alertsRes.data);
      setBatches(batchesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [filterBatchId, filterDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getBatchNumber = (batchId: number) => {
    const batch = batches.find((b) => b.id === batchId);
    return batch ? batch.batch_number : '未知批次';
  };

  const handleResetFilters = () => {
    setFilterBatchId('');
    setFilterDate('');
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...recordForm,
        batch_id: parseInt(recordForm.batch_id, 10),
        feed_quantity: parseFloat(recordForm.feed_quantity),
        water_temperature: recordForm.water_temperature
          ? parseFloat(recordForm.water_temperature)
          : undefined,
      };

      if (editingRecord) {
        await feedingRecordApi.update(editingRecord.id, data);
      } else {
        await feedingRecordApi.create(data);
      }

      setShowRecordModal(false);
      setEditingRecord(null);
      setRecordForm(emptyRecordForm);
      fetchData();
    } catch (error) {
      console.error('Error saving record:', error);
    }
  };

  const handleEditRecord = (record: FeedingRecord) => {
    setEditingRecord(record);
    setRecordForm({
      batch_id: record.batch_id.toString(),
      feeding_date: record.feeding_date,
      feed_type: record.feed_type,
      feed_quantity: record.feed_quantity.toString(),
      feeding_time: record.feeding_time || '',
      weather: record.weather || '',
      water_temperature: record.water_temperature?.toString() || '',
      notes: record.notes || '',
    });
    setShowRecordModal(true);
  };

  const handleDeleteRecord = async (id: number) => {
    if (window.confirm('确定要删除这条投喂记录吗？')) {
      try {
        await feedingRecordApi.delete(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting record:', error);
      }
    }
  };

  const openNewPlanModal = () => {
    setEditingPlan(null);
    setPlanFormError('');
    setPlanForm({
      ...emptyPlanForm,
      batch_id: filterBatchId || '',
      plan_date: filterDate || '',
    });
    setShowPlanModal(true);
  };

  const handleEditPlan = (plan: FeedingPlan) => {
    setEditingPlan(plan);
    setPlanFormError('');
    setPlanForm({
      batch_id: plan.batch_id.toString(),
      plan_date: plan.plan_date,
      planned_quantity_kg: plan.planned_quantity_kg.toString(),
      notes: plan.notes || '',
    });
    setShowPlanModal(true);
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanFormError('');
    const qty = parseFloat(planForm.planned_quantity_kg);
    if (!planForm.batch_id || !planForm.plan_date) {
      setPlanFormError('请选择批次和日期');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setPlanFormError('计划投喂量必须是大于 0 的数字(公斤)');
      return;
    }
    try {
      const data = {
        batch_id: parseInt(planForm.batch_id, 10),
        plan_date: planForm.plan_date,
        planned_quantity_kg: qty,
        notes: planForm.notes || undefined,
      };
      if (editingPlan) {
        await feedingPlanApi.update(editingPlan.id, data);
      } else {
        await feedingPlanApi.create(data);
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      setPlanForm(emptyPlanForm);
      fetchData();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setPlanFormError(typeof detail === 'string' ? detail : '保存失败，请稍后重试');
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (window.confirm('确定要删除这条投喂计划吗？(不会影响已有投喂记录)')) {
      try {
        await feedingPlanApi.delete(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting plan:', error);
      }
    }
  };

  const renderAlertBadge = (alert: FeedingAlert) => {
    if (!alert.is_alert) {
      return <span className="badge badge-success">正常</span>;
    }
    const pct = alert.deviation_pct ?? 0;
    if (pct > 0) {
      return <span className="badge badge-danger">超投 +{pct.toFixed(1)}%</span>;
    }
    return <span className="badge badge-warning">少投 {pct.toFixed(1)}%</span>;
  };

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'records', label: '实际投喂记录', icon: ListChecks },
    { key: 'plans', label: '投喂计划', icon: Calendar },
    { key: 'alerts', label: `投喂预警${alerts.length ? ` (${alerts.length})` : ''}`, icon: AlertTriangle },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">投喂管理</h1>
          <p className="text-gray-600 mt-1">登记投喂计划，对比实际投喂，查看偏差预警</p>
        </div>
        {activeTab === 'records' ? (
          <button
            onClick={() => {
              setEditingRecord(null);
              setRecordForm({
                ...emptyRecordForm,
                batch_id: filterBatchId || '',
                feeding_date: filterDate || '',
              });
              setShowRecordModal(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>新增记录</span>
          </button>
        ) : activeTab === 'plans' ? (
          <button onClick={openNewPlanModal} className="btn-primary flex items-center space-x-2">
            <Plus size={20} />
            <span>登记计划</span>
          </button>
        ) : null}
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">养殖批次</label>
            <select
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
              className="select-field"
            >
              <option value="">全部批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_number} - {batch.species} ({batch.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex items-end">
            <button onClick={handleResetFilters} className="btn-secondary w-full md:w-auto">
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-ocean-600 text-ocean-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'records' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>投喂日期</th>
                  <th>饲料类型</th>
                  <th>投喂量(公斤)</th>
                  <th>投喂时间</th>
                  <th>天气</th>
                  <th>水温(℃)</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="font-medium text-ocean-700">{getBatchNumber(record.batch_id)}</td>
                    <td>{record.feeding_date}</td>
                    <td>{record.feed_type}</td>
                    <td>{record.feed_quantity}</td>
                    <td>{record.feeding_time || '-'}</td>
                    <td>{record.weather || '-'}</td>
                    <td>{record.water_temperature || '-'}</td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="p-2 text-ocean-600 hover:bg-ocean-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      暂无投喂记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>计划日期</th>
                  <th>计划投喂量(公斤)</th>
                  <th>当日实际合计(公斤)</th>
                  <th>偏差</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => {
                  const dayTotal = records
                    .filter(
                      (r) => r.batch_id === plan.batch_id && r.feeding_date === plan.plan_date
                    )
                    .reduce((sum, r) => sum + Number(r.feed_quantity || 0), 0);
                  const diff = plan.planned_quantity_kg
                    ? ((dayTotal - plan.planned_quantity_kg) / plan.planned_quantity_kg) * 100
                    : 0;
                  const overThreshold = Math.abs(diff) > 20;
                  return (
                    <tr key={plan.id}>
                      <td className="font-medium text-ocean-700">{getBatchNumber(plan.batch_id)}</td>
                      <td>{plan.plan_date}</td>
                      <td>{plan.planned_quantity_kg}</td>
                      <td>{dayTotal.toFixed(2)}</td>
                      <td>
                        {dayTotal === 0 && plan.plan_date > new Date().toISOString().slice(0, 10) ? (
                          <span className="text-gray-400">待投喂</span>
                        ) : (
                          <span
                            className={
                              overThreshold
                                ? diff > 0
                                  ? 'text-red-600 font-medium'
                                  : 'text-yellow-600 font-medium'
                                : 'text-green-600'
                            }
                          >
                            {diff > 0 ? '+' : ''}
                            {diff.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td>{plan.notes || '-'}</td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditPlan(plan)}
                            className="p-2 text-ocean-600 hover:bg-ocean-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
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
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      暂无投喂计划，点击右上角"登记计划"开始安排
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="card">
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <div className="flex items-start space-x-2">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <span>
                以下为计划投喂量与当日实际投喂量偏差超过 20% 的预警（偏差 = (实际 - 计划) / 计划 × 100%）。
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>计划日期</th>
                  <th>计划(公斤)</th>
                  <th>实际(公斤)</th>
                  <th>偏差</th>
                  <th>状态</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.plan_id}>
                    <td className="font-medium text-ocean-700">{getBatchNumber(alert.batch_id)}</td>
                    <td>{alert.plan_date}</td>
                    <td>{alert.planned_quantity_kg}</td>
                    <td>{alert.actual_quantity_kg}</td>
                    <td
                      className={
                        (alert.deviation_pct ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-yellow-600 font-medium'
                      }
                    >
                      {alert.deviation_pct !== null && alert.deviation_pct !== undefined
                        ? `${alert.deviation_pct > 0 ? '+' : ''}${alert.deviation_pct.toFixed(1)}%`
                        : '-'}
                    </td>
                    <td>{renderAlertBadge(alert)}</td>
                    <td>{alert.notes || '-'}</td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      没有超出阈值的预警
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showRecordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRecord ? '编辑投喂记录' : '新增投喂记录'}
              </h2>
              <button onClick={() => setShowRecordModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  养殖批次 <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={recordForm.batch_id}
                  onChange={(e) => setRecordForm({ ...recordForm, batch_id: e.target.value })}
                  className="select-field"
                >
                  <option value="">请选择批次</option>
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} - {batch.species}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    投喂日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={recordForm.feeding_date}
                    onChange={(e) => setRecordForm({ ...recordForm, feeding_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    饲料类型 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={recordForm.feed_type}
                    onChange={(e) => setRecordForm({ ...recordForm, feed_type: e.target.value })}
                    className="input-field"
                    placeholder="如: 配合饲料"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    投喂量(公斤) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={recordForm.feed_quantity}
                    onChange={(e) => setRecordForm({ ...recordForm, feed_quantity: e.target.value })}
                    className="input-field"
                    placeholder="投喂量"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">投喂时间</label>
                  <input
                    type="time"
                    value={recordForm.feeding_time}
                    onChange={(e) => setRecordForm({ ...recordForm, feeding_time: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">天气</label>
                  <input
                    type="text"
                    value={recordForm.weather}
                    onChange={(e) => setRecordForm({ ...recordForm, weather: e.target.value })}
                    className="input-field"
                    placeholder="如: 晴"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">水温(℃)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={recordForm.water_temperature}
                    onChange={(e) => setRecordForm({ ...recordForm, water_temperature: e.target.value })}
                    className="input-field"
                    placeholder="水温"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="备注信息"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowRecordModal(false)} className="btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {editingRecord ? '保存修改' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPlan ? '编辑投喂计划' : '登记投喂计划'}
              </h2>
              <button onClick={() => setShowPlanModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  养殖批次 <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={planForm.batch_id}
                  onChange={(e) => setPlanForm({ ...planForm, batch_id: e.target.value })}
                  className="select-field"
                >
                  <option value="">请选择 active 批次</option>
                  {activeBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} - {batch.species}
                    </option>
                  ))}
                </select>
                {batches.some((b) => b.status !== 'active') && (
                  <p className="text-xs text-gray-500 mt-1">仅 active 状态批次可登记计划。</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  计划日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={planForm.plan_date}
                  onChange={(e) => setPlanForm({ ...planForm, plan_date: e.target.value })}
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
                  value={planForm.planned_quantity_kg}
                  onChange={(e) => setPlanForm({ ...planForm, planned_quantity_kg: e.target.value })}
                  className="input-field"
                  placeholder="如: 50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={planForm.notes}
                  onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="备注信息"
                />
              </div>

              {planFormError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {planFormError}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowPlanModal(false)} className="btn-secondary">
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  {editingPlan ? '保存修改' : '登记计划'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedingRecords;
