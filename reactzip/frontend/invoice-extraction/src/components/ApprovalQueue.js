import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';
import { 
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';

const ApprovalQueue = () => {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');

  const fetchPendingInvoices = async () => {
    setLoading(true);
    try {
      const divisions = selectedDivision === 'all' 
        ? ['engineering', 'ultra_filtration', 'water']
        : [selectedDivision];
      
      const allInvoices = [];
      
      for (const div of divisions) {
        const response = await fetch(
          `http://localhost:5000/get_invoices/${div}?status=pending`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const data = await response.json();
        if (response.ok) {
          allInvoices.push(...data.map(invoice => ({ ...invoice, division: div })));
        }
      }
      
      setInvoices(allInvoices);
    } catch (error) {
      setError('Failed to fetch pending invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingInvoices();
  }, [selectedDivision]);

  const handleApprove = async (division, id) => {
    try {
      const response = await fetch(
        `http://localhost:5000/approve_invoice/${division}/${id}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        fetchPendingInvoices();
      } else {
        setError('Failed to approve invoice');
      }
    } catch (error) {
      setError('Failed to approve invoice');
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="border rounded-md p-2"
          >
            <option value="all">All Divisions</option>
            <option value="engineering">Engineering</option>
            <option value="ultra_filtration">Ultra Filtration</option>
            <option value="water">Water</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="pb-3">Division</th>
                <th className="pb-3">Invoice #</th>
                <th className="pb-3">Supplier</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Processed By</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-4 text-center text-gray-500">
                    No pending invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t">
                    <td className="py-3 capitalize">{invoice.division.replace('_', ' ')}</td>
                    <td className="py-3">{invoice.invoice_number}</td>
                    <td className="py-3">{invoice.supplier_name}</td>
                    <td className="py-3">{invoice.invoice_date}</td>
                    <td className="py-3">{invoice.total_amount}</td>
                    <td className="py-3">{invoice.processed_by}</td>
                    <td className="py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(invoice.division, invoice.id)}
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Approve"
                        >
                          <CheckCircle size={20} />
                        </button>
                        <button
                          onClick={() => {
                            // Navigate to view invoice details
                            window.location.href = `/view/${invoice.division}/${invoice.id}`;
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination - if needed */}
      {invoices.length > 0 && (
        <div className="flex justify-center space-x-2">
          <button
            className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => {/* Handle previous page */}}
          >
            Previous
          </button>
          <button
            className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50"
            onClick={() => {/* Handle next page */}}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;