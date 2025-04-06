import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { aptosClient } from "@/utils/aptosClient";
import axios from "axios";
import { toast, Toaster } from "react-hot-toast";
import { Clock, Grid, Share2, MoreVertical, FileText, X, Eye, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

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
    bg: "bg-blue-100",
    border: "border-blue-200",
    text: "text-blue-600",
    icon: "text-blue-600",
    hover: "hover:border-blue-300",
  },
  pending: {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-600",
    icon: "text-amber-600",
    hover: "hover:border-amber-300",
  },
};

interface SharedDocsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SharedDocs({ isOpen, onClose }: SharedDocsProps) {
  const { account } = useWallet();
  const [isGridView, setIsGridView] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  const moduleAddress = process.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = process.env.VITE_APP_MODULE_NAME;

  useEffect(() => {
    if (account) {
      fetchUserDocuments();
    }
  }, [account]);

  useEffect(() => {
    if (!isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  const fetchUserDocuments = async () => {
    if (!account) return;
    try {
      const response = await aptosClient().view<[Document[]]>({
        payload: {
          function: `${moduleAddress}::${moduleName}::get_all_documents`,
          typeArguments: [],
          functionArguments: [],
        },
      });

      if (Array.isArray(response) && response.length > 0 && account) {
        const userDocuments = response[0].filter(
          (doc) => doc.signers.includes(account.address) && doc.creator !== account.address,
        );
        setDocuments(userDocuments);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to fetch documents");
    }
  };

  const fetchDocumentContent = async (cid: string) => {
    try {
      const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
      const response = await axios.get(url, { responseType: "blob" });
      return response.data;
    } catch (error) {
      console.error("Error fetching document content:", error);
      return null;
    }
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      setViewingDoc(doc);
      const content = await fetchDocumentContent(doc.content_hash);
      if (content) {
        setViewUrl(URL.createObjectURL(content));
      }
    } catch (error) {
      console.error("Error viewing document:", error);
      toast.error("Failed to load document");
    }
  };


  const handleShare = (docId: number) => {
    const signingLink = `${window.location.origin}/sign/${docId}`;
    navigator.clipboard.writeText(signingLink);
    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex items-center justify-between p-4 gap-3 border border-gray-200`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-gray-800">Signing link copied to clipboard</p>
          </div>
          <button onClick={() => toast.dismiss(t.id)} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ),
      {
        duration: 2000,
        position: "bottom-right",
      },
    );
  };

  const openIPFSFile = async (cid: string) => {
    const ipfsUrl = `https://ipfs.io/ipfs/${cid}`;
    const response = await axios.get(ipfsUrl, { responseType: "blob" });
    window.open(URL.createObjectURL(response.data), "_blank");
  };

  const DocumentCard = ({ doc }: { doc: Document }) => {
    const status = doc.is_completed ? "completed" : "pending";
    const styles = STATUS_STYLES[status];

    return (
      <div
        className={`group relative bg-white rounded-xl border ${styles.border} ${styles.hover} transition-all duration-200 shadow-sm hover:shadow-md`}
      >
        <div className={`absolute top-0 left-4 right-0 h-2 ${styles.bg} rounded-b-lg`}></div>

        <Link to={`/sign/${doc.id}`}>
          <div className="p-4 md:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg ${styles.bg} flex items-center justify-center`}>
                <FileText className={`w-5 h-5 ${styles.icon}`} />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleViewDocument(doc);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Eye className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleShare(doc.id);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Share2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-800">Document {doc.id}</h4>
              <p className="text-sm text-gray-500">
                {doc.signatures.length} of {doc.signers.length} signatures
              </p>
              <div className={`text-xs ${styles.text} flex items-center space-x-1`}>
                <span
                  className={`w-2 h-2 rounded-full ${status === "completed" ? "bg-blue-500" : "bg-amber-500"}`}
                ></span>
                <span>{status === "completed" ? "Completed" : "Pending"}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 text-gray-800 h-[90vh] overflow-auto">
      <Toaster />
      <div className="flex items-center justify-between p-4 md:p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-800">Shared Documents</h2>
        
      </div>

      {/* Content Area */}
      <div className="p-4 md:p-6 space-y-6">
        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Signed Documents */}
          <div className="p-6 rounded-xl bg-white shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-gray-800">Signed Documents</h3>
                <p className="text-sm text-gray-500">Successfully completed</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <div className="h-24 flex items-end">
                  <div
                    className="flex-1 bg-blue-100 rounded-t-lg transition-all duration-500"
                    style={{
                      height: documents.length
                        ? `${(documents.filter((doc) => doc.is_completed).length / documents.length) * 100}%`
                        : "0%",
                      minHeight: "10%",
                    }}
                  />
                </div>
                <div className="h-1 w-full bg-blue-100 mt-2" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {documents.filter((doc) => doc.is_completed).length}
              </div>
            </div>
          </div>

          {/* Pending Documents */}
          <div className="p-6 rounded-xl bg-white shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-gray-800">Pending Documents</h3>
                <p className="text-sm text-gray-500">Awaiting signatures</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <div className="h-24 flex items-end">
                  <div
                    className="flex-1 bg-amber-100 rounded-t-lg transition-all duration-500"
                    style={{
                      height: documents.length
                        ? `${(documents.filter((doc) => !doc.is_completed).length / documents.length) * 100}%`
                        : "0%",
                      minHeight: "10%",
                    }}
                  />
                </div>
                <div className="h-1 w-full bg-amber-100 mt-2" />
              </div>
              <div className="text-2xl font-bold text-amber-600">
                {documents.filter((doc) => !doc.is_completed).length}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-800">Your Documents</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsGridView(true)}
                className={`p-2 rounded-lg ${isGridView ? "bg-gray-100" : "hover:bg-gray-100"}`}
              >
                <Grid className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => setIsGridView(false)}
                className={`p-2 rounded-lg ${!isGridView ? "bg-gray-100" : "hover:bg-gray-100"}`}
              >
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div
            className={`grid gap-4 ${
              isGridView ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "grid-cols-1"
            }`}
          >
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      </div>



      {/* View Document Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-8 h-8 rounded-lg ${STATUS_STYLES[viewingDoc.is_completed ? "completed" : "pending"].bg} flex items-center justify-center`}
                >
                  <FileText
                    className={`w-4 h-4 ${STATUS_STYLES[viewingDoc.is_completed ? "completed" : "pending"].icon}`}
                  />
                </div>
                <div>
                  <h3 className="font-medium">Document {viewingDoc.id}</h3>
                  <p className="text-sm text-gray-400">
                    {viewingDoc.signatures.length} of {viewingDoc.signers.length} signatures
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openIPFSFile(viewingDoc.content_hash)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setViewingDoc(null);
                    setViewUrl(null);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4">
              {viewUrl ? (
                <iframe
                  src={viewUrl}
                  className="w-full h-full rounded-lg border border-gray-800"
                  title="Document Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">Loading document...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
