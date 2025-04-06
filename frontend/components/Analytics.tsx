import { useState, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileText, AlertCircle, FolderOpen, X, ExternalLink, Eye } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import axios from "axios";
import { aptosClient } from "@/utils/aptosClient";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { MonthlyBarChart } from "./BarChart.tsx";

type CategoryType = "financial";

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

const FINANCIAL_STYLE: StyleType = {
  bg: "bg-yellow-500/10",
  border: "border-yellow-500/20",
  text: "text-yellow-400",
  icon: "text-yellow-400",
  hover: "hover:border-yellow-500/50",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
interface AnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Analytics = ({ isOpen, onClose }: AnalyticsProps): JSX.Element => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    if (genAI && isOpen) {
      fetchAndAnalyzeDocuments();
    }
  }, [genAI, isOpen]);

  const fetchAndAnalyzeDocuments = async () => {
    setLoading(true);
    try {
      const response = await aptosClient().view<[Document[]]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_all_documents`,
          typeArguments: [],
          functionArguments: [],
        },
      });

      if (Array.isArray(response) && response.length > 0 && account) {
        const userDocuments = response[0].filter((doc: Document) => doc.creator === account.address);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const analyzedDocuments: Document[] = [];

        for (const doc of userDocuments) {
          try {
            const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
              responseType: "blob",
            });
            const blob = response.data;
            const fileType = blob.type;

            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.readAsDataURL(blob);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
            });
            const base64Content = base64Data.split(",")[1];

            let extractedContent = "";
            const billAnalysisPrompt = `
              Analyze this bill/invoice and extract ONLY these details:
              1. Total Amount (just the number)
              2. Date (in DD-MM-YYYY format)
              3. Month (full month name, e.g., January, February)
              
              Return EXACTLY in this format (maintain exact spacing and colons) ALWAYS:
              Amount: [just the number without currency symbol]
              Date: [DD-MM-YYYY]
              Month: [Month name]
            `;

            if (fileType.includes("image")) {
              const result = await model.generateContent({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: billAnalysisPrompt }, { inlineData: { mimeType: fileType, data: base64Content } }],
                  },
                ],
              });
              extractedContent = result.response.text();
            } else {
              const result = await model.generateContent({
                contents: [
                  {
                    role: "user",
                    parts: [{ text: billAnalysisPrompt }, { inlineData: { mimeType: fileType, data: base64Content } }],
                  },
                ],
              });
              extractedContent = result.response.text();
            }

            const categoryPrompt = `
              Based on this document content, determine if this is a financial document:

              ${extractedContent}

              Respond with ONLY 'financial' if it's a financial document (bank statements, invoices, financial records), or 'other' if it's not.
            `;

            const categoryResult = await model.generateContent(categoryPrompt);
            const category = categoryResult.response.text().trim().toLowerCase();

            if (category === "financial") {
              analyzedDocuments.push({
                ...doc,
                category: "financial" as CategoryType,
                extractedContent,
              });
            }
          } catch (error) {
            console.error(`Error processing document ${doc.id}:`, error);
          }
        }

        setDocuments(analyzedDocuments);
      }
    } catch (error) {
      console.error("Error processing documents:", error);
      setError("Failed to process financial documents");
    } finally {
      setLoading(false);
    }
  };

  const openIPFSFile = async (cid: string) => {
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    window.open(ipfsUrl, "_blank");
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      setSelectedDoc(doc);
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${doc.content_hash}`, {
        responseType: "blob",
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
      <div className=" bg-white flex items-center justify-center">
        <div className=" text-center">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 animate-pulse">Analyzing financial documents...</p>
        </div>
      </div>
    );
  }

  const organizeByMonth = () => {
    const monthlyDocs = new Map<string, Document[]>();
    const monthlyTotals = new Map<string, number>();

    // Initialize all months
    MONTHS.forEach((month) => {
      monthlyDocs.set(month, []);
      monthlyTotals.set(month, 0);
    });

    documents.forEach((doc) => {
      const monthMatch = doc.extractedContent?.match(/Month:\s*(\w+)/i);
      const amountMatch = doc.extractedContent?.match(/Amount:\s*([\d,.]+)/);

      if (monthMatch && monthMatch[1] && amountMatch && amountMatch[1]) {
        const month = monthMatch[1];
        const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

        monthlyDocs.get(month)?.push(doc);
        monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + amount);
      }
    });

    return { monthlyDocs, monthlyTotals };
  };

  const calculateTaxes = (amount: number) => {
    const gst = amount * 0.09;
    const cgst = amount * 0.09;
    return { gst, cgst };
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-white text-black p-8 overflow-y-auto">
      <Toaster />
      <h1 className="text-2xl font-bold mb-8 flex items-center space-x-3">
        <FolderOpen className="w-8 h-8 text-black" />
        <span>Monthly Expenditure</span>
        <span className="text-sm text-black">({documents.length} documents)</span>
      </h1>

      {error ? (
        <div className="p-4 rounded-lg bg-white border border-red-500/20 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bar Chart */}
          <MonthlyBarChart monthlyData={organizeByMonth().monthlyTotals} />
          {/* Monthly Sections */}
          {Array.from(organizeByMonth().monthlyDocs)
            .sort((a, b) => MONTHS.indexOf(a[0]) - MONTHS.indexOf(b[0]))
            .filter(([, docs]) => docs.length > 0)
            .map(([month, docs]) => (
              <div key={month} className="bg-white backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-black-400" />
                    <span>{month}</span>
                  </div>
                  <span className="text-sm text-gray-400">({docs.length} bills)</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docs.map((doc) => {
                    const amountMatch = doc.extractedContent?.match(/Amount:\s*([\d,.]+)/);
                    const dateMatch = doc.extractedContent?.match(/Date:\s*(.+?)(?=,|$)/);
                    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;
                    const date = dateMatch ? dateMatch[1] : "N/A";
                    const { gst, cgst } = calculateTaxes(amount);

                    return (
                      <div
                        key={doc.id}
                        className="relative bg-white-900/50 p-4 rounded-lg border border-gray-700 hover:border-yellow-500/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium">Bill #{doc.id}</h3>
                            <p className="text-sm text-gray-400">Date: {date}</p>
                            <p className="text-sm text-yellow-400">Amount: ₹{amount.toLocaleString()}</p>
                            <p className="text-sm text-blue-400">GST (9%): ₹{gst.toLocaleString()}</p>
                            <p className="text-sm text-green-400">CGST (9%): ₹{cgst.toLocaleString()}</p>
                            <p className="text-sm text-white">Total: ₹{(amount + gst + cgst).toLocaleString()}</p>
                          </div>
                          <button
                            onClick={() => handleViewDocument(doc)}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                            title="View Document"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDoc && viewUrl && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex-none flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg ${FINANCIAL_STYLE.bg} flex items-center justify-center`}>
                  <FileText className={`w-4 h-4 ${FINANCIAL_STYLE.icon}`} />
                </div>
                <div>
                  <h3 className="font-medium">Document {selectedDoc.id}</h3>
                  <p className="text-sm text-gray-400">
                    {selectedDoc.signatures.length} of {selectedDoc.signers.length} signatures
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openIPFSFile(selectedDoc.content_hash)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  title="Open in IPFS"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    onClose();
                    setSelectedDoc(null);
                    setViewUrl(null);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto relative">
              <iframe
                src={viewUrl}
                className="w-full h-full rounded-lg border border-gray-800"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
