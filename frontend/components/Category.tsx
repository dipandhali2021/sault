import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  FileText,
  AlertCircle,
  FolderOpen,
  Link2,
  X,
  ExternalLink,
  Eye
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import axios from 'axios';
import { aptosClient } from '@/utils/aptosClient';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

type CategoryType = 'personal identity' | 'legal' | 'education' | 'financial' | 'medical' | 'work' | 'other';

type StyleType = {
  bg: string;
  border: string;
  text: string;
  icon: string;
  hover: string;
};

interface Document {
  id: number;
  content_hash: string;
  creator: string;
  signers: string[];
  signatures: string[];
  is_completed: boolean;
  category?: CategoryType;
  extractedContent?: string;
}

interface CategoryGroup {
  [key: string]: Document[];
}

const STATUS_STYLES: Record<CategoryType, StyleType> = {
  'personal identity': {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700',
    icon: 'text-blue-600',
    hover: 'hover:border-blue-400'
  },
  'legal': {
    bg: 'bg-indigo-100',
    border: 'border-indigo-300',
    text: 'text-indigo-700',
    icon: 'text-indigo-600',
    hover: 'hover:border-indigo-400'
  },
  'education': {
    bg: 'bg-cyan-100',
    border: 'border-cyan-300',
    text: 'text-cyan-700',
    icon: 'text-cyan-600',
    hover: 'hover:border-cyan-400'
  },
  'financial': {
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    icon: 'text-emerald-600',
    hover: 'hover:border-emerald-400'
  },
  'medical': {
    bg: 'bg-rose-100',
    border: 'border-rose-300',
    text: 'text-rose-700',
    icon: 'text-rose-600',
    hover: 'hover:border-rose-400'
  },
  'work': {
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-700',
    icon: 'text-amber-600',
    hover: 'hover:border-amber-400'
  },
  'other': {
    bg: 'bg-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-700',
    icon: 'text-slate-600',
    hover: 'hover:border-slate-400'
  }
};

const DocumentCategories = () => {
  const [categorizedDocs, setCategorizedDocs] = useState<CategoryGroup>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [genAI, setGenAI] = useState<any>(null);

  const API_KEY = process.env.VITE_GEMINI_API_KEY;
  const moduleAddress = process.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = process.env.VITE_APP_MODULE_NAME;
  const { account } = useWallet();

  useEffect(() => {
    if (!API_KEY) {
      console.error('API key is not defined');
      return;
    }
    const ai = new GoogleGenerativeAI(API_KEY);
    setGenAI(ai);
  }, []);

  useEffect(() => {
    if (genAI) {
      fetchAndCategorizeDocuments();
    }
  }, [genAI]);

  const fetchAndCategorizeDocuments = async () => {
    setLoading(true);
    try {
      const response = await aptosClient().view<[Document[]]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_all_documents`,
          typeArguments: [],
          functionArguments: [],
        }
      });

      if (Array.isArray(response) && response.length > 0 && account) {
        const userDocuments = response[0].filter((doc: Document) => doc.creator === account.address);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const categorizedResults: Document[] = [];

        for (const doc of userDocuments) {
          try {
            const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
              responseType: 'blob'
            });
            const blob = response.data;
            const fileType = blob.type;

            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.readAsDataURL(blob);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
            });
            const base64Content = base64Data.split(',')[1];

            let extractedContent = '';
            if (fileType.includes('image')) {
              const result = await model.generateContent({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: "Describe this image comprehensively. Extract all visible text, identify key objects, and provide a detailed description." },
                    { inlineData: { mimeType: fileType, data: base64Content }}
                  ]
                }]
              });
              extractedContent = result.response.text();
            } else {
              const result = await model.generateContent({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: "Extract and summarize the main text content. Provide a comprehensive overview including key information, topics, and any significant details." },
                    { inlineData: { mimeType: fileType, data: base64Content }}
                  ]
                }]
              });
              extractedContent = result.response.text();
            }

            const categoryPrompt = `
              Based on this document content, determine the appropriate category:

              ${extractedContent}

              Categories:
              - personal identity (for ID documents like Aadhaar, PAN card, passport)
              - legal (for contracts, agreements, legal notices)
              - education (for certificates, marksheets, academic documents)
              - financial (for bank statements, invoices, financial records)
              - medical (for health records, prescriptions, medical reports)
              - work (for employment documents, offer letters)
              - other (if none of the above clearly match)

              Respond with ONLY the category name in lowercase.
            `;

            const categoryResult = await model.generateContent(categoryPrompt);
            const category = categoryResult.response.text().trim().toLowerCase() as CategoryType;
            const validCategories: CategoryType[] = ['personal identity', 'legal', 'education', 'financial', 'medical', 'work', 'other'];

            categorizedResults.push({
              ...doc,
              category: validCategories.includes(category) ? category : 'other',
              extractedContent
            });

          } catch (error) {
            console.error(`Error processing document ${doc.id}:`, error);
            categorizedResults.push({ ...doc, category: 'other' });
          }
        }

        const grouped = categorizedResults.reduce((acc, doc) => {
          const category = doc.category || 'other';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(doc);
          return acc;
        }, {} as CategoryGroup);

        setCategorizedDocs(grouped);
        localStorage.setItem('processedDocuments', JSON.stringify(categorizedResults));
      }
    } catch (error) {
      console.error("Error processing documents:", error);
      setError('Failed to process documents');
    } finally {
      setLoading(false);
    }
  };

  const openIPFSFile = async (cid: string) => {
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    window.open(ipfsUrl, '_blank');
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      setSelectedDoc(doc);
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setViewUrl(url);
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to load document");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] bg-white flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-blue-800 animate-pulse font-medium">Analyzing documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-gray-900 h-[90vh] overflow-y-auto">
      <Toaster />
      <div className="p-6">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-900 flex items-center gap-3">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            <span>Document Hub</span>
          </h1>
        </header>

        {error ? (
          <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 mb-8">
            <AlertCircle className="w-6 h-6 text-rose-600 flex-shrink-0" />
            <p className="text-rose-700 font-medium">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(categorizedDocs).map(([category, docs]) => (
              <section key={category} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
                  <h2 className="text-xl font-semibold text-white capitalize flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full bg-white`} />
                    <span>{category} Documents</span>
                    <span className="text-sm text-blue-100 font-normal">({docs.length})</span>
                  </h2>
                </div>

                <div className="p-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map((doc) => {
                      const styles = STATUS_STYLES[doc.category as CategoryType || 'other'];
                      return (
                        <div
                          key={doc.id}
                          className={`group relative bg-white rounded-xl border ${styles.border} shadow-sm hover:shadow-md transition-all duration-200 ${styles.hover}`}
                        >
                          <div className={`absolute top-0 left-0 right-0 h-2 ${styles.bg} rounded-b-lg`} />

                          <div className="p-4">
                            <div className="flex items-start justify-between mb-4 pt-2">
                              <div className={`w-12 h-12 rounded-lg ${styles.bg} flex items-center justify-center`}>
                                <FileText className={`w-6 h-6 ${styles.icon}`} />
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleViewDocument(doc)}
                                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                  title="View Document"
                                >
                                  <Eye className="w-5 h-5 text-blue-600" />
                                </button>
                                <button
                                  onClick={() => openIPFSFile(doc.content_hash)}
                                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                  title="Open in IPFS"
                                >
                                  <Link2 className="w-5 h-5 text-blue-600" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h3 className="font-medium text-lg">Document {doc.id}</h3>
                              <p className="text-gray-600">
                                {doc.signatures.length} of {doc.signers.length} signatures
                              </p>
                              <div className={`text-sm ${styles.text} flex items-center gap-2`}>
                                <span className={`w-2 h-2 rounded-full ${doc.is_completed ? 'bg-green-500' : 'bg-amber-500'}`} />
                                <span>{doc.is_completed ? 'Completed' : 'Pending'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Document Viewer Modal */}
        {selectedDoc && viewUrl && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${STATUS_STYLES[selectedDoc.category as CategoryType || 'other'].bg} flex items-center justify-center`}>
                    <FileText className={`w-5 h-5 ${STATUS_STYLES[selectedDoc.category as CategoryType || 'other'].icon}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg">Document {selectedDoc.id}</h3>
                    <p className="text-gray-600">
                      {selectedDoc.signatures.length} of {selectedDoc.signers.length} signatures
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openIPFSFile(selectedDoc.content_hash)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-blue-600"
                    title="Open in IPFS"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDoc(null);
                      setViewUrl(null);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 bg-gray-50">
                <iframe
                  src={viewUrl}
                  className="w-full h-full rounded-lg border border-gray-200 shadow-sm bg-white"
                  title="Document Preview"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCategories;  // Changed to default export