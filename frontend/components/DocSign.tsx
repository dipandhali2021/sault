import React, { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { aptosClient } from "@/utils/aptosClient";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';
import { IoHome } from "react-icons/io5";
import {
  FileText,
  Check,
  X,
  Clock,
  ExternalLink,
  PenTool,
  Shield,
  Link2
} from 'lucide-react';

interface Signature {
  signer: string;
  timestamp: string;
}

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: Signature[];
  is_completed: boolean;
}

const STATUS_STYLES = {
  completed: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
  pending: {
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-700',
    icon: 'text-amber-600',
  }
};

const SigningPage: React.FC = () => {
  const { account, signAndSubmitTransaction } = useWallet();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [viewDocumentUrl, setViewDocumentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const moduleAddress = import.meta.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = import.meta.env.VITE_APP_MODULE_NAME;

  useEffect(() => {
    if (id) {
      fetchDocument(Number(id));
    }
  }, [id]);

  // Add a helper function to format timestamps
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(Number(timestamp) / 1000); // Convert microseconds to milliseconds
    return date.toLocaleString(); // Or use more specific formatting like date.toLocaleString('en-US', options)
  };

  const fetchDocument = async (docId: number) => {
    setLoading(true);
    try {
      const response = await aptosClient().view<[Document]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_document`,
          typeArguments: [],
          functionArguments: [docId],
        },
      });

      if (response && response.length > 0) {
        const fetchedDocument = response[0];
        setDocument(fetchedDocument);
        handleViewDocument(fetchedDocument.content_hash);
      } else {
        toast.error('Document not found');
      }
    } catch (error) {
      console.error("Error fetching document:", error);
      toast.error('Failed to fetch the document');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (cid: string) => {
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const objectUrl = URL.createObjectURL(blob);
      setViewDocumentUrl(objectUrl);
    } catch (error) {
      console.error("Error fetching document:", error);
      toast.error("Failed to fetch the document");
    }
  };

  const openIPFSFile = async (cid: string) => {
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    const response = await axios.get(ipfsUrl, { responseType: 'blob' });
    window.open(URL.createObjectURL(response.data), '_blank');
  };

  const handleSignDocument = async () => {
    if (!account || !document) return;
    setSigning(true);
    try {
      const payload: InputTransactionData = {
        data: {
          function: `${moduleAddress}::${moduleName}::sign_document`,
          functionArguments: [document.id],
        }
      };
      await signAndSubmitTransaction(payload);
      toast.custom((_t) => (
        <div className="bg-white text-gray-800 px-6 py-4 shadow-xl rounded-lg border border-blue-200 animate-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-blue-600" />
            </div>
            <p>Document signed successfully!</p>
          </div>
        </div>
      ));
      navigate('/');
    } catch (error) {
      console.error("Error signing document:", error);
      toast.error('Failed to sign the document');
    } finally {
      setSigning(false);
    }
  };

  const canSign = () => {
    if (!account || !document) return false;
    return document.signers.includes(account.address) &&
           !document.signatures.some(sig => sig.signer === account.address) &&
           !document.is_completed;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 animate-pulse">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4 p-6 bg-white rounded-xl border border-gray-200 shadow-lg">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-medium text-gray-800">Document Not Found</h2>
          <p className="text-gray-600">The requested document could not be found.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white flex items-center justify-center gap-2 mx-auto"
          >
            <IoHome className="w-4 h-4" /> Return Home
          </button>
        </div>
      </div>
    );
  }

  const status = document.is_completed ? 'completed' : 'pending';
  const styles = STATUS_STYLES[status];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-full ${styles.bg} flex items-center justify-center ${styles.border} border`}>
              <FileText className={`w-6 h-6 ${styles.icon}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Document #{document.id}</h1>
              <p className="text-sm text-gray-500">
                Sign and verify document details
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-800 self-start md:self-auto flex items-center gap-2 border border-gray-200"
          >
            <IoHome className="w-5 h-5" /> Return to Dashboard
          </button>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Left Column - Document Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Status Cards */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
              <div className="p-4 space-y-2">
                <div className="flex items-center space-x-2 text-gray-500">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <div className={`flex items-center space-x-2 ${styles.text}`}>
                  <span className={`w-2 h-2 rounded-full ${status === 'completed' ? 'bg-blue-600' : 'bg-amber-500'}`} />
                  <span className="font-medium capitalize">{status}</span>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center space-x-2 text-gray-500">
                  <PenTool className="w-4 h-4" />
                  <span className="text-sm font-medium">Signatures</span>
                </div>
                <p className="font-medium">{document.signatures.length} of {document.signers.length}</p>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center space-x-2 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Created by</span>
                </div>
                <p className="font-medium truncate text-sm">{document.creator}</p>
              </div>
            </div>

            {/* Signers List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Signers</h3>
              <ul className="space-y-2">
                {document.signers.map((signer, index) => {
                  const signature = document.signatures.find(sig => sig.signer === signer);
                  return (
                    <li 
                      key={index} 
                      className={`p-3 rounded-lg border ${signature ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">Signer {index + 1}</span>
                        {signature ? (
                          <div className="flex items-center text-blue-600">
                            <Check className="w-4 h-4 mr-1" />
                            <span className="text-xs">Signed</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-amber-600">
                            <Clock className="w-4 h-4 mr-1" />
                            <span className="text-xs">Pending</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-800 truncate">{signer}</p>
                      {signature && (
                        <span className="text-xs text-gray-500 block mt-1">
                          {formatTimestamp(signature.timestamp)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Sign Button */}
            {canSign() && (
              <button
                onClick={handleSignDocument}
                disabled={signing}
                className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {signing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing...</span>
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4" />
                    <span>Sign Document</span>
                  </>
                )}
              </button>
            )}
            
            {!canSign() && !loading && (
              <div className={`p-4 rounded-lg ${document.is_completed ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'} text-center`}>
                <p className="text-sm text-gray-600">
                  {document.is_completed
                    ? 'This document has been fully signed by all parties.'
                    : 'You are not authorized to sign this document.'}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Document Viewer */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
              {/* Document Header */}
              <div className="bg-gray-50 border-b border-gray-100 p-3 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Document Preview</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openIPFSFile(document.content_hash)}
                    className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => window.open(`https://ipfs.io/ipfs/${document.content_hash}`, '_blank')}
                    className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                    title="View on IPFS"
                  >
                    <Link2 className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              
              {/* Document Viewer */}
              {viewDocumentUrl ? (
                <iframe
                  src={viewDocumentUrl}
                  className="w-full h-[60vh]"
                  title="Document Viewer"
                />
              ) : (
                <div className="h-[70vh] flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SigningPage;