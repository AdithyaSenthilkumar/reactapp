import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { Card } from './ui/card.jsx';
import { Calendar } from './ui/calendar.jsx';
import { 
  BarChart,
  FileText,
  Clock,
  CheckCircle,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
const Dashboard = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    submitted: 0,
    processed: 0,
    pending: 0
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date()
  });
  const [invoices, setInvoices] = useState([]);

  const fetchStats = async () => {
    try {
      const divisions = ['engineering', 'ultra_filtration', 'water'];
      let totalStats = { submitted: 0, processed: 0, pending: 0 };
      const uniqueInvoices = new Map();

      for (const division of divisions) {
        const response = await fetch(
          `http://localhost:5000/get_invoices/${division}?start_date=${format(dateRange.from, 'yyyy-MM-dd')}&end_date=${format(dateRange.to, 'yyyy-MM-dd')}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const data = await response.json();
        
        if (response.ok) {
          data.forEach(invoice => {
            // Use invoice number as unique identifier
            if (!uniqueInvoices.has(invoice.invoice_number)) {
              uniqueInvoices.set(invoice.invoice_number, {
                ...invoice,
                division
              });
            }
          });
          
          totalStats.submitted += data.length;
          totalStats.processed += data.filter(i => i.status === 'approved').length;
          totalStats.pending += data.filter(i => i.status === 'pending').length;
        }
      }
      
      setStats(totalStats);
      // Convert Map to Array and take only the last 5 invoices
      setInvoices([...uniqueInvoices.values()].slice(-10));
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDateRangeChange = (range) => {
    if (range?.from && range?.to) {
      setDateRange(range);
    }
  };
  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const exportData = (format_req) => {
    const data = invoices.map(invoice => ({
      division: invoice.division,
      invoice_number: invoice.invoice_number,
      supplier_name: invoice.supplier_name,
      invoice_date: invoice.invoice_date,
      total_amount: invoice.total_amount,
      scanning_date: invoice.scanning_date

    }));

    if (format_req=== 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    } else if (format_req === 'excel') {
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
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
       {user?.role !== 'gate' && ( <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Submitted Files</p>
              <p className="text-2xl font-semibold">{stats.submitted}</p>
            </div>
          </div>
        </Card>)}

        {user?.role !== 'gate' && (<Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Processed Files</p>
              <p className="text-2xl font-semibold">{stats.processed}</p>
            </div>
          </div>
        </Card>)}

       {user?.role !== 'gate' &&( <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-2xl font-semibold">{stats.pending}</p>
            </div>
          </div>
        </Card>)}
        {user?.role === 'gate' && ( <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Submitted Files</p>
              <p className="text-2xl font-semibold">{stats.submitted}</p>
            </div>
          </div>
        </Card>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {user?.role !== 'gate' && (<Card className="col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Recent Invoices</h2>
            <div className="space-x-2">
              <button
                onClick={() => exportData('json')}
                className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
              >
                Export JSON
              </button>
              <button
                onClick={() => exportData('excel')}
                className="px-4 py-2 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100"
              >
                Export Excel
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500">
                  <th className="pb-3">Invoice #</th>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {invoices.slice(0, 10).map((invoice, index) => (
                  <tr key={index} className="border-t">
                    <td className="py-3">{invoice.invoice_number}</td>
                    <td className="py-3">{invoice.supplier_name}</td>
                    <td className="py-3">{invoice.total_amount}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          invoice.status === 'approved'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-yellow-100 text-yellow-600'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>)}

        {user?.role !== 'gate' &&(<Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Date Range</h2>
          <Popover>
            <PopoverTrigger asChild>
                 <button
                className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 border"
                   >
                  {format(dateRange.from, 'MM/dd/yyyy')} - {format(dateRange.to, 'MM/dd/yyyy')}
                   </button>
            </PopoverTrigger>
           <PopoverContent className="p-2 w-auto">
                <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={handleDateRangeChange}
                      className="rounded-md border"
                      />
            </PopoverContent>
        </Popover>
        </Card>)}
      </div>
    </div>
  );
};
export default Dashboard;
