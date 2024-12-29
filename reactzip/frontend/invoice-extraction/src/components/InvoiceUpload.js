import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { Card } from './ui/card.jsx';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InvoiceUpload = () => {
  const { token } = useAuth();
  const [division, setDivision] = useState('');
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
      setExtractedData(null);
    } else {
      setFile(null);
      setError('Please select a valid PDF file');
      setExtractedData(null);
    }
  };

  const handleUpload = async () => {
    if (!division) {
      setError('Please select a division');
      return;
    }
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(
        `http://localhost:5000/upload_invoice/${division}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        setExtractedData(data.data);
        console.log("Navigating to edit page ",data);
        navigate(`/edit/${division}/${data.id}`);
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to upload and process invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Upload Invoice</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Division
            </label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option value="">Choose division...</option>
              <option value="engineering">Engineering</option>
              <option value="ultra_filtration">Ultra Filtration</option>
              <option value="water">Water</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload PDF Invoice
            </label>
            <div
              className="border-2 border-dashed rounded-md p-6 relative"
               >
              <div className="text-center pointer-events-none">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-1 text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF up to 10MB</p>
              </div>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading || !file || !division}
            className={`w-full py-2 px-4 rounded-md text-white ${
              loading || !file || !division
                ? 'bg-gray-400'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : 'Upload and Process'}
          </button>
        </div>
      </Card>
    </div>
  );
};
export default InvoiceUpload;
