import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, ClipboardList } from 'lucide-react';
import { feedingRecordApi, feedingPlanApi, batchApi } from '../services/api';
import type { FeedingRecord, FeedingPlan, FeedingDeviationAlert, Batch } from '../types';

const emptyRecordForm = {
  batch_id: '',
  feeding_date: '',
  feed_type: '',
  feed_quantity: '',
  feeding_time: '',
  weather: '',
  water_temperature: '',
  notes: ''
};

const emptyPlanForm = {
  batch_id: '',
  plan_date: '',
  planned_quantity: '',
  notes: ''
};

const FeedingRecords: React.FC = () => {
  const [records, setRecords] = useState<FeedingRecord[]>([]);
  const [plans, setPlans] = useState<FeedingPlan[]>([]);
  const [alerts, setAlerts] = useState<FeedingDeviationAlert[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // 按批次和日期筛选
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FeedingRecord | null>(null);
  const [formData, setFormData] = useState(emptyRecordForm);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planFormData, setPlanFormData] = useState(emptyPlanForm);
  const [planError, setPlanError] = useState('');

  const activeBatches = batches.filter((b) => b.status === 'active');

  // 选定日期后，实际投喂列表只显示当天数据（后端接口仅支持按批次过滤，日期在前端过滤）
  const visibleRecords = filterDate
    ? records.filter((r) => r.feeding_date === filterDate)
    : records;

  const fetchData = async () => {
    try {
      const batchId = filterBatchId ? parseInt(filterBatchId) : undefined;
      const planDate = filterDate || undefined;
      const [recordsRes, plansRes, alertsRes, batchesRes] = await Promise.all([
        feedingRecordApi.getAll(batchId),
        feedingPlanApi.getAll(batchId, planDate),
        feedingPlanApi.getAlerts(batchId, planDate),
        batchApi.getAll()
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
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBatchId, filterDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        batch_id: parseInt(formData.batch_id),
        feed_quantity: parseFloat(formData.feed_quantity),
        water_temperature: formData.water_temperature ? parseFloat(formData.water_temperature) : undefined
      };

      if (editingRecord) {
        await feedingRecordApi.update(editingRecord.id, data);
      } else {
        await feedingRecordApi.create(data);
      }

      setShowModal(false);
      setEditingRecord(null);
      setFormData(emptyRecordForm);
      fetchData();
    } catch (error) {
      console.error('Error saving record:', error);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanError('');
    try {
      await feedingPlanApi.create({
        batch_id: parseInt(planFormData.batch_id),
        plan_date: planFormData.plan_date,
        planned_quantity: parseFloat(planFormData.planned_quantity),
        notes: planFormData.notes || undefined
      });
      setShowPlanModal(false);
      setPlanFormData(emptyPlanForm);
      fetchData();
    } catch (error: any) {
      setPlanError(error?.response?.data?.detail || '保存计划失败');
      console.error('Error saving plan:', error);
    }
  };

  const handleEdit = (record: FeedingRecord) => {
    setEditingRecord(record);
    setFormData({
      batch_id: record.batch_id.toString(),
      feeding_date: record.feeding_date,
      feed_type: record.feed_type,
      feed_quantity: record.feed_quantity.toString(),
      feeding_time: record.feeding_time || '',
      weather: record.weather || '',
      water_temperature: record.water_temperature?.toString() || '',
      notes: record.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('确定要删除这条记录吗？')) {
      try {
        await feedingRecordApi.delete(id);
        fetchData();
      } catch (error) {
        console.error('Error deleting record:', error);
      }
    }
  };

  const handleDeletePlan = async (id: number) => {
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
          <h1 className="text-2xl font-bold text-gray-900">投喂记录</h1>
          <p className="text-gray-600 mt-1">记录日常投喂信息，登记投喂计划并监控偏差预警</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setPlanError('');
              setPlanFormData(emptyPlanForm);
              setShowPlanModal(true);
            }}
            className="btn-secondary flex items-center space-x-2"
          >
            <ClipboardList size={20} />
            <span>登记投喂计划</span>
          </button>
          <button
            onClick={() => {
              setEditingRecord(null);
              setFormData(emptyRecordForm);
              setShowModal(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>新增记录</span>
          </button>
        </div>
      </div>

      {/* 按批次和日期筛选 */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">按批次筛选</label>
            <select
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
              className="select-field"
            >
              <option value="">全部批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_number} - {batch.species}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">按日期筛选</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input-field"
            />
          </div>
          {(filterBatchId || filterDate) && (
            <button
              onClick={() => {
                setFilterBatchId('');
                setFilterDate('');
              }}
              className="btn-secondary"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 偏差预警：偏差超过 20% 触发 */}
      {alerts.length > 0 && (
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="text-red-600" size={22} />
            <h2 className="text-lg font-bold text-gray-900">投喂偏差预警</h2>
            <span className="badge badge-warning">{alerts.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>计划日期</th>
                  <th>计划量(公斤)</th>
                  <th>实际量(公斤)</th>
                  <th>偏差(公斤)</th>
                  <th>偏差比例</th>
                  <th>方向</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, idx) => (
                  <tr key={`${a.batch_id}-${a.plan_date}-${idx}`}>
                    <td className="font-medium text-ocean-700">{a.batch_number}</td>
                    <td>{a.plan_date}</td>
                    <td>{a.planned_quantity}</td>
                    <td>{a.actual_quantity}</td>
                    <td className="text-red-600 font-medium">
                      {a.deviation > 0 ? `+${a.deviation}` : a.deviation}
                    </td>
                    <td className="text-red-600 font-medium">
                      {(a.deviation_ratio * 100).toFixed(1)}%
                    </td>
                    <td>
                      <span className={`badge ${a.direction === 'over' ? 'badge-warning' : 'badge-info'}`}>
                        {a.direction === 'over' ? '超量' : '不足'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 投喂计划 */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-4">投喂计划</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>批次号</th>
                <th>计划日期</th>
                <th>计划量(公斤)</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="font-medium text-ocean-700">{getBatchNumber(plan.batch_id)}</td>
                  <td>{plan.plan_date}</td>
                  <td>{plan.planned_quantity}</td>
                  <td>{plan.notes || '-'}</td>
                  <td>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    暂无投喂计划
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-4">实际投喂记录</h2>
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
              {visibleRecords.map((record) => (
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
                        onClick={() => handleEdit(record)}
                        className="p-2 text-ocean-600 hover:bg-ocean-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRecords.length === 0 && (
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRecord ? '编辑投喂记录' : '新增投喂记录'}
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
                </label>
                <select
                  required
                  value={formData.batch_id}
                  onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
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
                    value={formData.feeding_date}
                    onChange={(e) => setFormData({ ...formData, feeding_date: e.target.value })}
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
                    value={formData.feed_type}
                    onChange={(e) => setFormData({ ...formData, feed_type: e.target.value })}
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
                    value={formData.feed_quantity}
                    onChange={(e) => setFormData({ ...formData, feed_quantity: e.target.value })}
                    className="input-field"
                    placeholder="投喂量"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    投喂时间
                  </label>
                  <input
                    type="time"
                    value={formData.feeding_time}
                    onChange={(e) => setFormData({ ...formData, feeding_time: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    天气
                  </label>
                  <input
                    type="text"
                    value={formData.weather}
                    onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
                    className="input-field"
                    placeholder="如: 晴"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    水温(℃)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.water_temperature}
                    onChange={(e) => setFormData({ ...formData, water_temperature: e.target.value })}
                    className="input-field"
                    placeholder="水温"
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
                  {editingRecord ? '保存修改' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">登记投喂计划</h2>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="space-y-4">
              {planError && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2">
                  {planError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  养殖批次 <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={planFormData.batch_id}
                  onChange={(e) => setPlanFormData({ ...planFormData, batch_id: e.target.value })}
                  className="select-field"
                >
                  <option value="">请选择批次（仅养殖中）</option>
                  {activeBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} - {batch.species}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">只有养殖中(active)的批次可以建立计划</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    计划日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={planFormData.plan_date}
                    onChange={(e) => setPlanFormData({ ...planFormData, plan_date: e.target.value })}
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
                    value={planFormData.planned_quantity}
                    onChange={(e) => setPlanFormData({ ...planFormData, planned_quantity: e.target.value })}
                    className="input-field"
                    placeholder="计划量"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={planFormData.notes}
                  onChange={(e) => setPlanFormData({ ...planFormData, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="备注信息"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button type="submit" className="btn-primary">
                  保存计划
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
