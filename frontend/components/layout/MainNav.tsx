import { WalletName, useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { AccountInfo } from "../Account";
import { NetworkInfo } from "../Network";

interface MainNavProps {
  showAccountInfo: boolean;
  setShowAccountInfo: (show: boolean) => void;
}

export default function MainNav({ showAccountInfo, setShowAccountInfo }: MainNavProps) {
  const { account, connect, disconnect } = useWallet();

  return (
    <>
      {/* Header Navigation */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 md:px-6 py-4 flex items-center justify-end">
          {!account ? (
            <button
              onClick={() => connect("Petra" as WalletName<"Petra">)}
              className="px-4 md:px-6 py-2 text-sm md:text-base rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors text-white"
            >
              Connect
            </button>
          ) : (
            <div className="flex items-center space-x-3">
              <Button
                className="hidden md:inline text-sm text-white bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowAccountInfo(true)}
              >
                {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
              </Button>
              <button
                onClick={() => disconnect()}
                className="px-4 py-2 text-sm rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Account Info Modal */}
      {showAccountInfo && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAccountInfo(false)}
        >
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-blue-900">Account Details</h3>
              <button
                onClick={() => setShowAccountInfo(false)}
                className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <X className="w-5 h-5 text-black-900" />
              </button>
            </div>
            <div className="space-y-8 text-black-800">
              <AccountInfo />
              <NetworkInfo />
            </div>
          </div>
        </div>
      )}
    </>
  );
}