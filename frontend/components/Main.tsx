import { useState, useEffect } from "react";
import Sidebar from "./layout/Sidebar";
import MainNav from "./layout/MainNav";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { aptosClient } from "@/utils/aptosClient";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-react";
import axios from "axios";
import { toast, Toaster } from "react-hot-toast";
import {
  Clock,
  Grid,
  Share2,
  Upload,
  MoreVertical,
  FileText,
  X,
  Eye,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

interface Signer {
  address: string;
  label?: string;
}

const STATUS_STYLES = {
  completed: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-600",
    icon: "text-blue-600",
    hover: "hover:border-blue-500",
  },
  pending: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600",
    icon: "text-amber-600",
    hover: "hover:border-amber-500",
  },
};


export default function ContractManagement() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");
  const [isGridView, setIsGridView] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState<Document[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [signersList, setSignersList] = useState<Signer[]>([]);

  const moduleAddress = process.env.VITE_APP_MODULE_ADDRESS;
  const moduleName = process.env.VITE_APP_MODULE_NAME;

  console.log(pendingDocuments);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsSidebarCollapsed(mobile);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (account) {
      fetchUserDocuments();
      fetchPendingDocuments();
      // Initialize signersList with current user's address
      setSignersList([{ address: account.address }]);
    }
  }, [account]);

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
          (doc) => doc.creator === account.address || doc.signers.includes(account.address),
        );
        console.log(userDocuments);
        setDocuments(userDocuments);
      } else {
        setDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast.error("Failed to fetch documents");
    }
  };

  const fetchPendingDocuments = async () => {
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
        const pendingDocs = response[0].filter(
          (doc) =>
            doc.signers.includes(account.address) &&
            !doc.signatures.some((sig) => sig.signer === account.address) &&
            !doc.is_completed,
        );
        setPendingDocuments(pendingDocs);
      } else {
        setPendingDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching pending documents:", error);
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

  const uploadToPinata = async (file: File) => {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    let formData = new FormData();
    formData.append("file", file);

    const metadata = JSON.stringify({
      name: "Document File",
    });
    formData.append("pinataMetadata", metadata);

    try {
      const res = await axios.post(url, formData, {
        headers: {
          pinata_api_key: process.env.VITE_APP_PINATA_API_KEY,
          pinata_secret_api_key: process.env.VITE_APP_PINATA_SECRET_API_KEY,
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data.IpfsHash;
    } catch (error) {
      console.error("Error uploading to Pinata:", error);
      throw error;
    }
  };

  const handleCreateDocument = async () => {
    if (!account || !file || signersList.every((s) => !s.address.trim())) return;
    setLoading(true);
    try {
      const cid = await uploadToPinata(file);
      const signerAddresses = signersList
        .filter((signer) => signer.address.trim() !== "")
        .map((signer) => signer.address.trim());

      const payload: InputTransactionData = {
        data: {
          function: `${moduleAddress}::${moduleName}::create_document`,
          functionArguments: [cid, signerAddresses],
        },
      };
      await signAndSubmitTransaction(payload);
      setIsModalOpen(false);
      setFile(null);
      setSignersList([{ address: "" }]);
      fetchUserDocuments();
      toast.custom((_t) => (
        <div className="bg-white text-gray-800 px-6 py-4 shadow-lg rounded-lg border border-gray-200 animate-in slide-in-from-bottom-5">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <p>Document uploaded successfully</p>
          </div>
        </div>
      ));
    } catch (error) {
      console.error("Error creating document:", error);
      toast.error("Failed to upload document");
    } finally {
      setLoading(false);
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setIsModalOpen(true);
    }
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

        <Link to={`/sign/${doc.id}`} className="block h-full transition-all hover:transform hover:translate-y-[-2px]">
          <div className="h-full flex flex-col border border-gray-200 shadow-sm hover:shadow rounded-xl overflow-hidden bg-white">
            {/* Document Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full ${styles.bg} flex items-center justify-center`}>
                  <FileText className={`w-5 h-5 ${styles.icon}`} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 truncate">Document {doc.id}</h4>
                </div>
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${
                  status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${status === "completed" ? "bg-green-500" : "bg-amber-500"}`}
                ></span>
                <span>{status === "completed" ? "Completed" : "Pending"}</span>
              </div>
            </div>

            {/* Document Content */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(doc.signatures.length / doc.signers.length) * 100}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Signatures</span>
                  <span className="text-sm text-gray-800 font-bold">
                    {doc.signatures.length}/{doc.signers.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Footer */}
            <div className="flex items-center justify-between bg-gray-50 p-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleViewDocument(doc);
                }}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleShare(doc.id);
                }}
                className="flex items-center space-x-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Toaster />
      {/* Main Layout */}
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          isMobile={isMobile}
        />
        {/* Main Content */}
        <div className="flex-1 ml-20 md:ml-0 overflow-y-auto">
          <MainNav showAccountInfo={showAccountInfo} setShowAccountInfo={setShowAccountInfo} />

          {/* Content Area */}
          <div className="p-4 md:p-6 space-y-6">
            {/* Statistics Section - Changed to top row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Signed Documents */}
              {/* Document Statistics */}
              <div className="p-6 rounded-xl bg-white shadow-md border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1 mb-4">
                    <h3 className="text-lg font-medium text-gray-800">Document Statistics</h3>
                    <p className="text-sm text-gray-500 ">Summary of all the documents uploaded</p>
                  </div>
                  <div className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span className="text-sm text-gray-600">Completed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-amber-500 rounded"></div>
                      <span className="text-sm text-gray-600">Pending</span>
                    </div>
                  </div>
                </div>
                {/* Grid to display two separate graphs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Completed Documents Graph */}
                  <div className="h-[200px] w-full">
                    <div className="mb-2 text-center font-medium text-gray-700">Completed Documents</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            completed: documents.filter((doc) => doc.is_completed).length,
                          },
                        ]}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(229, 231, 235, 0.3)" }}
                          contentStyle={{
                            backgroundColor: "#FFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: "0.5rem",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            padding: "8px 12px",
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                          formatter={(value) => [`${value} Documents`, undefined]}
                        />
                        <Bar
                          name="Completed"
                          dataKey="completed"
                          fill="#3B82F6"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pending Documents Graph */}
                  <div className="h-[200px] w-full">
                    <div className="mb-2 text-center font-medium text-gray-700">Pending Documents</div>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            pending: documents.filter((doc) => !doc.is_completed).length,
                          },
                        ]}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(229, 231, 235, 0.3)" }}
                          contentStyle={{
                            backgroundColor: "#FFF",
                            border: "1px solid #E5E7EB",
                            borderRadius: "0.5rem",
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            padding: "8px 12px",
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                          formatter={(value) => [`${value} Documents`, undefined]}
                        />
                        <Bar name="Pending" dataKey="pending" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Documents Summary */}
              <div className="p-6 rounded-xl bg-white shadow-md border border-gray-200">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {documents.filter((doc) => doc.is_completed).length}
                        </p>
                        <p className="text-sm text-gray-500">Total Completed</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">
                          {documents.filter((doc) => !doc.is_completed).length}
                        </p>
                        <p className="text-sm text-gray-500">Total Pending</p>
                      </div>
                    </div>
                  </div>
                  {/* Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 md:p-6 text-center transition-colors bg-white
                ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <p className="text-gray-600 mb-2 text-sm md:text-base">Drag and drop your files here</p>
                    <p className="text-gray-500 text-xs md:text-sm mb-4">OR</p>
                    <button
                      onClick={() => document.getElementById("file-input")?.click()}
                      className="px-4 md:px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm md:text-base"
                    >
                      Browse
                    </button>
                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setFile(e.target.files[0]);
                          setIsModalOpen(true);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Documents Grid */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800">Your Documents</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsGridView(true)}
                    className={`p-2 rounded-lg ${isGridView ? "bg-gray-100 text-blue-600" : "hover:bg-gray-100 text-gray-600"}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsGridView(false)}
                    className={`p-2 rounded-lg ${!isGridView ? "bg-gray-100 text-blue-600" : "hover:bg-gray-100 text-gray-600"}`}
                  >
                    <MoreVertical className="w-4 h-4" />
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
        </div>
      </div>

      {/* Enhanced Upload Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-xl w-full max-w-md animate-in zoom-in-95 duration-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200">
              <div className="flex justify-between items-center p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800">Upload Document</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <X className="w-5 h-5 text-gray-600 group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* File Upload Section */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 
            ${file ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}`}
              >
                {file ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="font-medium truncate text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button
                      onClick={() => setFile(null)}
                      className="text-sm text-red-600 hover:text-red-700 transition-colors"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => document.getElementById("modal-file-input")?.click()}
                    className="cursor-pointer space-y-2"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6 text-gray-500" />
                    </div>
                    <p className="text-gray-600">Drop your file here or click to browse</p>
                    <p className="text-xs text-gray-500">Maximum file size: 25MB</p>
                  </div>
                )}
                <input
                  id="modal-file-input"
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile && selectedFile.size <= 25 * 1024 * 1024) {
                      setFile(selectedFile);
                    } else {
                      toast.error("File size must be less than 25MB");
                    }
                  }}
                />
              </div>

              {/* Signers Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Signers</label>
                <div className="space-y-2">
                  {signersList.map((signer, index) => (
                    <div
                      key={index}
                      className="group flex items-center space-x-2 animate-in slide-in-from-left duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <input
                        type="text"
                        value={signer.address}
                        onChange={(e) => {
                          const newList = [...signersList];
                          newList[index].address = e.target.value;
                          setSignersList(newList);
                        }}
                        placeholder="Enter signer address"
                        className="flex-1 px-4 py-2 rounded-lg bg-white border border-gray-300 focus:border-blue-500 outline-none transition-colors text-sm text-gray-800"
                      />
                      {signersList.length > 1 && (
                        <button
                          onClick={() => {
                            const newList = signersList.filter((_, i) => i !== index);
                            setSignersList(newList);
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSignersList([...signersList, { address: "" }])}
                  className="w-full px-4 py-2 rounded-lg border border-dashed border-gray-300 hover:border-blue-500 text-gray-600 hover:text-blue-600 transition-all text-sm focus:outline-none"
                >
                  + Add another signer
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 p-6">
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-900 hover:bg-black transition-colors text-white text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDocument}
                  disabled={loading || !file || signersList.every((s) => !s.address.trim())}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  ) : (
                    "Upload Document"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
