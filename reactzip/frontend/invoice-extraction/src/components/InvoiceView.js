import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';

const InvoiceView = () => {
  const { division, id } = useParams();
  const { token } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/get_invoice/${division}/${id}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setInvoice(data);
        } else {
          setError('Failed to fetch invoice details');
        }
      } catch (err) {
        setError('Failed to fetch invoice details');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [division, id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-md">
        {error}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md">
        Invoice not found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
        <div className="space-y-4">
          {Object.entries(invoice).map(([key, value]) => (
            key !== 'pdf_path' && (
              <div key={key} className="grid grid-cols-2 gap-4">
                <div className="text-sm font-medium text-gray-500">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div className="text-sm text-gray-900">
                  {typeof value === 'object' ? JSON.stringify(value) : value}
                </div>
              </div>
            )
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Invoice PDF</h2>
        <div className="aspect-[3/4] bg-gray-100 rounded-lg">
          {invoice.pdf_path && (
            <iframe
              src={`http://localhost:5000/get_pdf/${division}/${id}`}
              className="w-full h-full rounded-lg"
              title="Invoice PDF"
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default InvoiceView;