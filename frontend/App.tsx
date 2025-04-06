import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletSelector } from "./components/Selector";
import SigningDocument from "@/components/DocSign";
import Categorize from "@/components/Category";
import ContractManagement from "./components/Main";

function App() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow">
        {connected ? (
          <Router>
            <Routes>
              <Route path="/" element={<ContractManagement />} />
              <Route path="/categorize" element={<Categorize />} />
              <Route path="/sign/:id" element={<SigningDocument />} />
            </Routes>
          </Router>
        ) : (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-blue-50">
              <CardHeader className="pb-2 text-center border-b border-blue-100">
                <div className="w-18 h-20  mx-auto mb-4 rounded-full flex items-center justify-center">
                  <img src="/logo.png" alt="Logo" className="w-18 h-20 mr-2" />
                </div>
                <CardTitle className="text-2xl font-bold text-blue-800">Welcome to Sault</CardTitle>
                <p className="text-blue-600 mt-2">Your trusted document management solution</p>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="grid grid-cols-1 gap-6 mb-6">
                  {[
                    { title: "Secure", desc: "Your documents are stored securely." },
                    { title: "Vast Storage", desc: "Store a large number of documents." },
                    { title: "Fast Retrieval", desc: "Quickly access your documents." },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start pl-20 space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        {idx === 0 && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        )}
                        {idx === 1 && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            />
                          </svg>
                        )}
                        {idx === 2 && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-blue-800">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 border-t border-blue-100 pt-4">
                <div className="mt-2 flex justify-center items-center flex-col ">
                  <p className="text-center text-sm text-gray-500 mb-4">Connect your wallet to get started</p>
                  <div >
                    <WalletSelector />
                  </div>
                </div>
                <p className="text-xs text-center text-gray-500">By connecting, you agree to our Terms of Service</p>
              </CardFooter>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;