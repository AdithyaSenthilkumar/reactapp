// src/components/InvoiceView.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './ui/card';
import PdfViewer from './PdfViewer'; // Import the PdfViewer component
import { useNavigate } from 'react-router-dom';

const InvoiceView = () => {
    const { division, id } = useParams();
    const { token } = useAuth();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedInvoice, setEditedInvoice] = useState({});
    const { user } = useAuth();
    const [parsedData, setParsedData] = useState(null);
    const navigate = useNavigate();
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditedInvoice(prev => ({ ...prev, [name]: value }));
    };
    const handleLineItemChange = (index, field, value) => {
        const updatedLineItems = [...parsedData.line_items];
        updatedLineItems[index][field] = value;

        // Update the editedInvoice and parsedData state
        setParsedData((prev) => ({ ...prev, line_items: updatedLineItems }));
        setEditedInvoice((prev) => ({
            ...prev,
            data: JSON.stringify({ ...parsedData, line_items: updatedLineItems }),
        }));
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
                    const parsed = data.data ? JSON.parse(data.data) : null;
                    setParsedData(parsed);
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
                if (response.ok) {
                    setIsEditing(false);
                    setInvoice(editedInvoice);
                } else {
                    setError('Failed to update invoice details');
                }
            } catch (err) {
                setError('Failed to update invoice details');
                console.error(err);

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
                <h2 className="text-lg font-semibold mb-4">Invoice PDF</h2>
                <div className="aspect-[3/4] bg-gray-100 rounded-lg">
                    <PdfViewer division={division} id={id} />
                </div>
            </Card>
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Invoice Details</h2>
                    {
                        <button
                            onClick={handleEdit}
                            className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                        >
                            {isEditing ? 'Save' : 'Edit'}
                        </button>}
                </div>
                <div className="space-y-4">
                    {Object.entries(invoice).map(([key, value]) => (
                        key !== 'pdf_path' && key !== 'data' && (
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
                                ) : (
                                    <div className="text-sm text-gray-900">
                                        {typeof value === 'object' ? JSON.stringify(value) : value}
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                </div>
                <div className="mt-4">
          <h3 className="text-md font-semibold mb-2">Products</h3>

          {/* Line Item Headers */}
          <div className="grid grid-cols-5 gap-2 font-bold">
            <div>Description</div>
            <div>Code</div>
            <div>Quantity</div>
            <div>Price</div>
            <div>Line Total</div>
          </div>

          {/* Line Items */}
          {parsedData && parsedData.line_items && Array.isArray(parsedData.line_items) ? (
            parsedData.line_items.map((item, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2 border-b pb-2">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={item.item_description || ''}
                      onChange={(e) => handleLineItemChange(index, 'item_description', e.target.value)}
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Description"
                    />
                    <input
                      type="text"
                      value={item.product_code || ''}
                      onChange={(e) => handleLineItemChange(index, 'product_code', e.target.value)}
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Product Code"
                    />
                    <input
                      type="text"
                      value={item.quantity || ''}
                      onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Quantity"
                    />
                    <input
                      type="text"
                      value={item.unit_Price || ''}
                      onChange={(e) => handleLineItemChange(index, 'unit_Price', e.target.value)}
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Unit Price"
                    />
                    <input
                      type="text"
                      value={item.line_total || ''}
                      onChange={(e) => handleLineItemChange(index, 'line_total', e.target.value)}
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Line Total"
                    />
                  </>
                ) : (
                  <>
                    <div className="text-sm">{item.item_description}</div>
                    <div className="text-sm">{item.product_code}</div>
                    <div className="text-sm">{item.quantity}</div>
                    <div className="text-sm">{item.unit_Price}</div>
                    <div className="text-sm">{item.line_total}</div>
                  </>
                )}
              </div>
            ))
          ) : (
            <p>No line items available</p>
          )}
        </div>


            </Card>

            
        </div>
    );
};

export default InvoiceView;
