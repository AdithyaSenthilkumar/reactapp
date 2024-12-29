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
    const [isEditing, setIsEditing] = useState(false);
   const [editedInvoice, setEditedInvoice] = useState({});
    const { user } = useAuth();

   const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedInvoice(prev => ({ ...prev, [name]: value }));
  };

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
             setEditedInvoice(data);

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

    const handleEdit = async () => {
        if (isEditing) {
          try {
            const response = await fetch(
              `http://localhost:5000/edit_invoice/${division}/${id}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(editedInvoice),
              }
            );
            if(response.ok)
            {
                  setIsEditing(false);
                  setInvoice(editedInvoice);

            }else{
                 setError('Failed to update invoice details');
            }
           
          } catch (err) {
            setError('Failed to update invoice details');
          }
          
        } else {
          setIsEditing(true);
        }
    };
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Invoice Details</h2>
             {user?.role === 'gate' && (
             <button
                        onClick={handleEdit}
                        className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                        >
                         {isEditing ? 'Save' : 'Edit'}
                    </button>)}
        </div>
        <div className="space-y-4">
          {Object.entries(invoice).map(([key, value]) => (
            key !== 'pdf_path' && key !=='data' && (
              <div key={key} className="grid grid-cols-2 gap-4">
                <div className="text-sm font-medium text-gray-500">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </div>
                    {isEditing ? (
                         <input
                                type="text"
                                name={key}
                                value={editedInvoice[key] || ''}
                                onChange={handleInputChange}
                                className="text-sm text-gray-900 border rounded p-1"
                            />
                         ):(
                             <div className="text-sm text-gray-900">
                               {typeof value === 'object' ? JSON.stringify(value) : value}
                            </div>
                     )}
              </div>
            )
          ))}
        </div>
      </Card>

      <Card className="p-6">
  <h2 className="text-lg font-semibold mb-4">Invoice PDF</h2>
  <div className="aspect-[3/4] bg-gray-100 rounded-lg">
    {invoice.pdf_path ? (
      <iframe
        src={`http://localhost:5000${invoice.pdf_path}`}
        className="w-full h-full rounded-lg"
        title="Invoice PDF"
      />
    ) : (
      <p className="text-sm text-gray-500">No PDF available</p>
    )}
  </div>
</Card>
    </div>
  );
};

export default InvoiceView;
