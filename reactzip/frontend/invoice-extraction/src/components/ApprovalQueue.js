import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';
import {
  CheckCircle,
  Eye,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const ApprovalQueue = () => {
  const { token, user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });
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
          `http://localhost:5000/get_invoices/${div}?status=pending&start_date=${format(dateRange.from, 'yyyy-MM-dd')}&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await response.json();
        if (response.ok) {
          allInvoices.push(...data.map((invoice) => ({ ...invoice, division: div })));
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
  }, [selectedDivision, token, dateRange]);


    const handleGenerateReport = async (format) => {
        try {
          const response = await fetch(`http://localhost:5000/generate_report?start_date=${format(dateRange.from, 'yyyy-MM-dd')}&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

        const data = await response.json();
          if (response.ok) {
             if (format === 'json') {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `report_${format(new Date(), 'yyyy-MM-dd')}.json`;
                  a.click();
                } else if (format === 'excel') {
                  // Convert to CSV for Excel
                  const headers = Object.keys(data[0]).join(',');
                  const rows = data.map(obj => Object.values(obj).join(','));
                  const csv = [headers, ...rows].join('\n');
                  
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `invoices_${format(new Date(), 'yyyy-MM-dd')}.csv`;
                  a.click();
                }
           } else {
            setError('Failed to generate report');
            console.error('Generate report failed:', data.error);
          }
        } catch (error) {
           setError('Failed to generate report');
          console.error('Generate report error:', error);
        }
  };



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
              <div>
                 <h2 className="text-lg font-semibold">Pending Approvals</h2>
                    <Popover>
                         <PopoverTrigger asChild>
                              <button
                                   className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 border mt-2"
                                   >
                                   {format(dateRange.from, 'MM/dd/yyyy')} - {format(dateRange.to, 'MM/dd/yyyy')}
                              </button>
                         </PopoverTrigger>
                         <PopoverContent className="p-2 w-auto">
                              <Calendar
                                   mode="range"
                                   selected={dateRange}
                                   onSelect={setDateRange}
                                   className="rounded-md border"
                                   />
                         </PopoverContent>
                    </Popover>
              </div>
                <div className="space-x-2">
                    <button
                         onClick={() => handleGenerateReport('json')}
                         className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                         >
                           Export JSON
                     </button>
                     <button
                          onClick={() => handleGenerateReport('excel')}
                          className="px-4 py-2 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100"
                          >
                           Export Excel
                    </button>
              </div>
          </div>

          <div className="flex justify-between items-center mb-6">
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
                  <th className="pb-3">Reference #</th>
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
                    <td colSpan="8" className="py-4 text-center text-gray-500">
                      No pending invoices found
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="py-3 capitalize">{invoice.division.replace('_', ' ')}</td>
                      <td className="py-3">{invoice.reference_number}</td>
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
    </div>
  );
};

export default ApprovalQueue;
