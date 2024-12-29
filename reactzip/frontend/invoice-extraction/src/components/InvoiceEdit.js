import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "./ui/card";
import PdfViewer from "./PdfViewer";

const InvoiceEdit = () => {
  const { division, id } = useParams();
  const { token } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editedInvoice, setEditedInvoice] = useState({});
  const [parsedData, setParsedData] = useState(null);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedInvoice((prev) => ({ ...prev, [name]: value }));
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
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setInvoice(data);
          setEditedInvoice(data);

          // Parse the data JSON to get line items
          const parsed = data.data ? JSON.parse(data.data) : null;
          setParsedData(parsed);
        } else {
          setError("Failed to fetch invoice details");
        }
      } catch (err) {
        setError("Failed to fetch invoice details");
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
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(editedInvoice),
        }
      );
      if (response.ok) {
        navigate(`/view/${division}/${id}`);
      } else {
        setError("Failed to update invoice details");
      }
    } catch (err) {
      setError("Error");
      console.error(err);
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
    return <div className="p-4 bg-red-100 text-red-700 rounded-md">{error}</div>;
  }

  if (!invoice) {
    return (
      <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md">
        Invoice not found
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex space-x-6">
      {/* PDF Viewer */}
      <div className="w-1/2">
        <h2 className="text-lg font-semibold mb-4">Invoice PDF</h2>
        <div className="aspect-[3/4] bg-gray-100 rounded-lg">
          <PdfViewer division={division} id={id} />
        </div>
      </div>

      {/* Editable Fields */}
      <div className="w-1/2 space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Edit Invoice</h2>
          <div className="space-y-4">
            {/* Editable Fields */}
            {Object.entries(invoice).map(([key, value]) =>
              key !== "s3_filepath" &&
              key !== "processed_by" &&
              key !== "approved_by" &&
              key !== "line_items" &&
              key !== "pdf_path" &&
              key !== "data" ? (
                <div key={key} className="grid grid-cols-2 gap-4">
                  <div className="text-sm font-medium text-gray-500">
                    {key.replace(/_/g, " ").toUpperCase()}
                  </div>
                  <input
                    type="text"
                    name={key}
                    value={editedInvoice[key] || ""}
                    onChange={handleInputChange}
                    className="text-sm text-gray-900 border rounded p-1"
                  />
                </div>
              ) : null
            )}

            {/* Line Items */}
            <div className="mt-4">
              <h3 className="text-md font-semibold mb-2">Products</h3>
              <div className="grid grid-cols-5 gap-2 font-bold">
            <div>Description</div>
            <div>Code</div>
            <div>Quantity</div>
            <div>Price</div>
            <div>Line Total</div>
          </div>
              {parsedData && parsedData.line_items && Array.isArray(parsedData.line_items) ? (
                parsedData.line_items.map((item, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 mb-2 border-b pb-2">
                    <input
                      type="text"
                      value={item.item_description || ""}
                      onChange={(e) =>
                        handleLineItemChange(index, "item_description", e.target.value)
                      }
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Description"
                    />
                    <input
                      type="text"
                      value={item.product_code || ""}
                      onChange={(e) =>
                        handleLineItemChange(index, "product_code", e.target.value)
                      }
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Product Code"
                    />
                    <input
                      type="text"
                      value={item.quantity || ""}
                      onChange={(e) =>
                        handleLineItemChange(index, "quantity", e.target.value)
                      }
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Quantity"
                    />
                    <input
                      type="text"
                      value={item.unit_Price || ""}
                      onChange={(e) =>
                        handleLineItemChange(index, "unit_Price", e.target.value)
                      }
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Unit Price"
                    />
                    <input
                      type="text"
                      value={item.line_total || ""}
                      onChange={(e) =>
                        handleLineItemChange(index, "line_total", e.target.value)
                      }
                      className="text-sm text-gray-900 border rounded p-1"
                      placeholder="Line Total"
                    />
                  </div>
                ))
              ) : (
                <p>No line items available</p>
              )}
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InvoiceEdit;
