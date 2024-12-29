import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';

const InvoiceEdit = () => {
  const { division, id } = useParams();
  const { token } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
   const [editedInvoice, setEditedInvoice] = useState({});
    const navigate = useNavigate();

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

    const handleSave = async () => {
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
                 navigate(`/view/${division}/${id}`);

            }else{
                 setError('Failed to update invoice details');
            }
           
          } catch (err) {
            setError('Failed to update invoice details');
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
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Edit Invoice</h2>
        <div className="space-y-4">
          {Object.entries(invoice).map(([key, value]) => (
            key !== 'pdf_path' && key !=='data' && (
              <div key={key} className="grid grid-cols-2 gap-4">
                <div className="text-sm font-medium text-gray-500">
                  {key.replace(/_/g, ' ').toUpperCase()}
                </div>
                    <input
                          type="text"
                           name={key}
                           value={editedInvoice[key] || ''}
                           onChange={handleInputChange}
                           className="text-sm text-gray-900 border rounded p-1"
                       />
              </div>
            )
          ))}
              <button
                onClick={handleSave}
                className="w-full py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Save
              </button>
        </div>
      </Card>
    </div>
  );
};

export default InvoiceEdit;
