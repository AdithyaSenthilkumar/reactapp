// src/components/InvoiceList.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Card } from './ui/card';
import { Eye } from 'lucide-react';

const InvoiceList = () => {
  const { token, user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');


  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
         const divisions = ['engineering', 'ultra_filtration', 'water'];
         let allInvoices = [];

         for (const division of divisions) {
           const response = await fetch(
               `http://localhost:5000/get_invoices/${division}`,
               {
                 headers: { Authorization: `Bearer ${token}` },
               }
             );

             if (response.ok) {
                 const data = await response.json();
                 allInvoices = [...allInvoices, ...data.map(invoice => ({...invoice, division}))];
               } else {
                 setError('Failed to fetch invoices.');
               }
         }
       setInvoices(allInvoices);
     }
     catch (err) {
       setError('Failed to fetch invoices.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [token]);


 const filteredInvoices = divisionFilter === 'all' ? invoices : invoices.filter(invoice => invoice.division === divisionFilter);



  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
      );
  }

  if (error) {
      return <div className="p-4 bg-red-100 text-red-700 rounded-md">{error}</div>;
  }

  return (
    <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Invoices</h2>
          <div className="mb-4">
             <label htmlFor="divisionFilter" className="block text-sm font-medium text-gray-700 mr-2">Filter by Division:</label>
             <select
               id="divisionFilter"
               value={divisionFilter}
               onChange={(e) => setDivisionFilter(e.target.value)}
               className="mt-1 p-2 border rounded-md w-auto"
             >
               <option value="all">All</option>
               <option value="engineering">Engineering</option>
               <option value="ultra_filtration">Ultra Filtration</option>
               <option value="water">Water</option>
             </select>
         </div>
         <div className="overflow-x-auto">
             <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500">
                      <th className="pb-3">Invoice #</th>
                      <th className="pb-3">Supplier</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">View</th>
                  </tr>
                </thead>
                  <tbody className="text-sm">
                     {filteredInvoices.map((invoice) => (
                       <tr key={invoice.id} className="border-t">
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
                             <td className="py-3">
                               <Link to={`/view/${invoice.division}/${invoice.id}`}>
                                    <Eye className="h-4 w-4 text-gray-600 hover:text-blue-600" />
                               </Link>
                           </td>
                        </tr>
                      ))}
                  </tbody>
             </table>
         </div>
    </Card>
  );
};

export default InvoiceList;
