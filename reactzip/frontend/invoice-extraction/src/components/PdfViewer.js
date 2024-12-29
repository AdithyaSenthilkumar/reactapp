// src/components/PdfViewer.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const PdfViewer = ({ division, id }) => {
  const { token } = useAuth();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPdf = async () => {
      setLoading(true);
        setError(null)
      try {
        const response = await fetch(
          `http://localhost:5000/get_pdf/${division}/${id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const blob = await response.blob();
          setPdfUrl(URL.createObjectURL(blob));
        } else {
            const errorData = await response.json();
          setError(errorData.message || 'Failed to fetch PDF');
        }
      } catch (err) {
        setError('Failed to fetch PDF');
      } finally {
        setLoading(false);
      }
    };

    fetchPdf();

    // Cleanup function to revoke the blob URL when the component unmounts
    return () => {
        if(pdfUrl){
          URL.revokeObjectURL(pdfUrl);
        }
    };
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

  return (
    <iframe
      src={pdfUrl}
      className="w-full h-full rounded-lg"
      title="Invoice PDF"
    />
  );
};

export default PdfViewer;
