import React, { useState, useEffect } from "react";
import { User, Role, Customer, AppSettings } from "../types";
import {
  LogIn,
  UserPlus,
  ShieldCheck,
  Smartphone,
  Mail,
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Square,
  Cpu,
  Lock,
  ChevronRight,
  Wrench,
  Settings,
  Zap,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebaseConfig";
interface LoginProps {
  onLogin: (user: User) => void;
  teamMembers: User[];
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
}

export default function Login({
  onLogin,
  teamMembers,
  customers,
  setCustomers,
}: LoginProps) {
  // Default to 'customer' as requested
  const [activeTab, setActiveTab] = useState<"staff" | "customer">("customer");

  // Staff State
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPass, setStaffPass] = useState("");

  // Customer State
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custName, setCustName] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Common State
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Load Saved Credentials on Mount or Tab Change ---
  useEffect(() => {
    setError(null);
    if (activeTab === "staff") {
      const savedStaff = localStorage.getItem("nexus_staff_login");
      if (savedStaff) {
        try {
          const { email, pass } = JSON.parse(savedStaff);
          setStaffEmail(email || "");
          setStaffPass(pass || "");
          setRememberMe(true);
        } catch (e) {
          console.error("Failed to parse saved staff credentials");
        }
      } else {
        setStaffEmail("");
        setStaffPass("");
        setRememberMe(false);
      }
    } else {
      const savedCust = localStorage.getItem("nexus_cust_login");
      if (savedCust) {
        try {
          const { email, phone } = JSON.parse(savedCust);
          setCustEmail(email || "");
          setCustPhone(phone || "");
          setRememberMe(true);
        } catch (e) {
          console.error("Failed to parse saved customer credentials");
        }
      } else {
        setCustEmail("");
        setCustPhone("");
        setRememberMe(false);
      }
    }
  }, [activeTab]);

  const simulateLoading = (callback: () => void) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      callback();
    }, 800); // Fake delay for UX feel
  };

  const handleStaffLogin =async (e: React.FormEvent) => {
    e.preventDefault();
  setError(null);
  setIsLoading(true);

  try {
    // 1️⃣ Firebase Auth login
    const userCred = await signInWithEmailAndPassword(
      auth,
      staffEmail,
      staffPass
    );

    // 2️⃣ Fetch staff profile
    const snap = await getDoc(doc(db, "users", userCred.user.uid));

    if (!snap.exists()) {
      throw new Error("Staff profile not found");
    }

    const data = snap.data();

    // 3️⃣ Role validation
    if (data.role !== "TECHNICIAN" && data.role !== "MANAGER" && data.role !== "ADMIN") {
      throw new Error("Not authorized as staff");
    }

    // 4️⃣ Remember me
    if (rememberMe) {
      localStorage.setItem(
        "nexus_staff_login",
        JSON.stringify({ email: staffEmail })
      );
    } else {
      localStorage.removeItem("nexus_staff_login");
    }

    // 5️⃣ Login success
    onLogin({
      id: userCred.user.uid,
      name: data.name,
      email: data.email,
      role: data.role,
    });

  } catch (err: any) {
    setError("Invalid email or password");
  } finally {
    setIsLoading(false);
  }
  };

  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const existingCustomer = customers.find(
      (c) => c.email.toLowerCase() === custEmail.toLowerCase()
    );

    if (isSignUp) {
      if (existingCustomer) {
        setError("Account with this email already exists. Please login.");
        return;
      }
      if (!custName || !custPhone || !custAddress) {
        setError("All fields are required for registration.");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 1️⃣ Create user in Firebase Auth
        const userCred = await createUserWithEmailAndPassword(
          auth,
          custEmail,
          custPhone // using phone as password (for now)
        );

        // 2️⃣ Save customer profile in Firestore
        await setDoc(doc(db, "customers", userCred.user.uid), {
          name: custName,
          email: custEmail,
          mobile: custPhone,
          address: custAddress,
          role: "CUSTOMER",
          createdAt: serverTimestamp(),
        });

        // 3️⃣ Login user in app
        onLogin({
          id: userCred.user.uid,
          name: custName,
          email: custEmail,
          role: "CUSTOMER",
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }

      {
        /*const newCustomer: Customer = {
            id: `CUST-${String(customers.length + 1).padStart(3, '0')}`,
            name: custName,
            email: custEmail,
            mobile: custPhone,
            address: custAddress
        };
        
        setCustomers([...customers, newCustomer]);
        
        const userObj: User = {
            id: newCustomer.id,
            name: newCustomer.name,
            email: newCustomer.email,
            role: 'CUSTOMER',
        };
*/
      }
      if (rememberMe) {
        localStorage.setItem(
          "nexus_cust_login",
          JSON.stringify({ email: custEmail, phone: custPhone })
        );
      }

      //simulateLoading(() => onLogin(userObj));
    } else {
      {
        /* if (existingCustomer) {
        if (existingCustomer.mobile === custPhone) {
          const userObj: User = {
            id: existingCustomer.id,
            name: existingCustomer.name,
            email: existingCustomer.email,
            role: "CUSTOMER",
          };

          if (rememberMe) {
            localStorage.setItem(
              "nexus_cust_login",
              JSON.stringify({ email: custEmail, phone: custPhone })
            );
          } else {
            localStorage.removeItem("nexus_cust_login");
          }

          simulateLoading(() => onLogin(userObj));
        } else {
          setError(
            "Invalid credentials. Password is your registered phone number."
          );
        }
      } else {
        setError("Customer not found. Please sign up.");
      }*/
      }
      try {
        setIsLoading(true);
        setError(null);

        // 1️⃣ Firebase Auth login
        const userCred = await signInWithEmailAndPassword(
          auth,
          custEmail,
          custPhone
        );

        // 2️⃣ Fetch customer profile from Firestore
        const snap = await getDoc(doc(db, "customers", userCred.user.uid));

        if (!snap.exists()) {
          throw new Error("Customer profile not found");
        }

        const data = snap.data();

        onLogin({
          id: userCred.user.uid,
          name: data.name,
          email: data.email,
          role: "CUSTOMER",   
        });
      } catch (err: any) {
        setError("Invalid email or password");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8 font-sans overflow-hidden relative">
      {/* CSS for custom animations */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes float-reverse {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(15px) rotate(-5deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-blob { animation: blob 10s infinite alternate; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float 4s ease-in-out infinite; animation-delay: 1s; }
        .animate-float-reverse { animation: float-reverse 7s ease-in-out infinite; }
        .bg-shimmer {
           background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
           background-size: 200% 100%;
           animation: shimmer 3s infinite;
        }
      `}</style>

      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-full min-h-[650px] relative z-10 animate-in fade-in zoom-in-95 duration-500 ring-1 ring-black/5">
        {/* LEFT SIDE: Visuals (Hidden on Mobile) */}
        <div className="hidden md:flex w-full md:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-10 text-white">
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-slate-900 opacity-90"></div>
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

          {/* Floating Shapes */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500 rounded-full mix-blend-overlay filter blur-3xl opacity-50 animate-blob"></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

          {/* Floating Icons for Fun */}
          <div className="absolute top-20 right-10 opacity-20 animate-float">
            <Wrench size={64} />
          </div>
          <div className="absolute bottom-32 right-20 opacity-20 animate-float-delayed">
            <Settings size={48} />
          </div>
          <div className="absolute bottom-10 left-10 opacity-20 animate-float-reverse">
            <Zap size={56} />
          </div>
          <div className="absolute top-1/2 left-10 opacity-10 animate-float">
            <Smartphone size={40} />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8 group cursor-pointer">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 group-hover:bg-white/20">
                <Cpu size={24} className="text-cyan-300" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white group-hover:tracking-widest transition-all duration-300">
                INFOFIX SERVICES
              </span>
            </div>

            <div className="space-y-6">
              <h1 className="text-4xl lg:text-5xl font-black leading-tight drop-shadow-lg">
                Expert Repair <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                  Management
                </span>
              </h1>
              <p className="text-indigo-100 text-lg max-w-sm leading-relaxed border-l-4 border-cyan-400 pl-4 bg-white/5 py-2 rounded-r-lg backdrop-blur-sm">
                Streamline your workflow, track repairs in real-time, and
                deliver exceptional service experiences.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12">
            <div className="flex items-center gap-4 text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4">
              Trusted By
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-2 w-12 bg-white/20 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                ></div>
              ))}
            </div>
            <p className="mt-8 text-xs text-white/40 font-medium hover:text-white/80 transition-colors cursor-default">
              © 2025 InfoFix Services. Secure Access.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE: Form */}
        <div className="w-full md:w-1/2 bg-white p-8 lg:p-12 flex flex-col justify-center relative">
          <div className="max-w-md mx-auto w-full relative z-10">
            {/* Mobile Only Header */}
            <div className="md:hidden text-center mb-6 animate-in slide-in-from-top-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <Cpu size={20} />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-800">
                  INFOFIX
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                Expert Repair Management
              </p>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">
                Welcome Back
              </h2>
              <p className="text-slate-500 text-sm mt-2">
                Please enter your details to sign in.
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex mb-8 relative">
              {/* Sliding Background */}
              <div
                className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${
                  activeTab === "customer" ? "left-1.5" : "left-[calc(50%+3px)]"
                }`}
              ></div>

              <button
                onClick={() => {
                  setActiveTab("customer");
                  setError(null);
                }}
                className={`flex-1 relative z-10 py-2.5 text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 ${
                  activeTab === "customer"
                    ? "text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Smartphone
                  size={16}
                  className={`transition-transform duration-300 ${
                    activeTab === "customer" ? "scale-110" : ""
                  }`}
                />{" "}
                Customer
              </button>

              <button
                onClick={() => {
                  setActiveTab("staff");
                  setError(null);
                  setIsSignUp(false);
                }}
                className={`flex-1 relative z-10 py-2.5 text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 ${
                  activeTab === "staff"
                    ? "text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <ShieldCheck
                  size={16}
                  className={`transition-transform duration-300 ${
                    activeTab === "staff" ? "scale-110" : ""
                  }`}
                />{" "}
                Staff Login
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-xl flex items-center gap-3 animate-in slide-in-from-top-2 shake">
                <AlertCircle size={18} className="shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* FORMS CONTAINER */}
            <div className="relative min-h-[320px]">
              {/* CUSTOMER FORM */}
              {activeTab === "customer" && (
                <form
                  onSubmit={handleCustomerLogin}
                  className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300 fill-mode-both"
                >
                  {isSignUp && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          value={custName}
                          onChange={(e) => setCustName(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="group">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">
                          Address
                        </label>
                        <input
                          type="text"
                          required
                          autoComplete="street-address"
                          value={custAddress}
                          onChange={(e) => setCustAddress(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                          placeholder="City, Street..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">
                      Email Address
                    </label>
                    <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail
                          size={18}
                          className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                        />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={custEmail}
                        onChange={(e) => setCustEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">
                      {isSignUp
                        ? "Mobile Number (Sets Password)"
                        : "Password (Mobile Number)"}
                    </label>
                    <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Smartphone
                          size={18}
                          className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                        />
                      </div>
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        value={custPhone}
                        onChange={(e) => setCustPhone(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="555-0123"
                      />
                    </div>
                  </div>

                  {!isSignUp && (
                    <div
                      className="flex items-center gap-2 cursor-pointer group select-none pt-2"
                      onClick={() => setRememberMe(!rememberMe)}
                    >
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 ${
                          rememberMe
                            ? "bg-indigo-600 border-indigo-600"
                            : "bg-white border-slate-300 group-hover:border-indigo-400"
                        }`}
                      >
                        {rememberMe && (
                          <CheckSquare size={12} className="text-white" />
                        )}
                      </div>
                      <span className="text-sm text-slate-600 font-medium group-hover:text-slate-800">
                        Remember me
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-4 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden group ${
                      isSignUp
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-200"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-200"
                    }`}
                  >
                    <div className="absolute inset-0 bg-shimmer opacity-20 pointer-events-none"></div>
                    {isLoading ? (
                      "Processing..."
                    ) : isSignUp ? (
                      <>
                        <UserPlus size={20} /> Create Account
                      </>
                    ) : (
                      <>
                        <LogIn size={20} /> Login
                      </>
                    )}
                  </button>

                  {/* HIGHLIGHTED "NEW CUSTOMER" BOX */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                      }}
                      className="w-full relative group overflow-hidden bg-white border-2 border-slate-100 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 p-4 rounded-2xl transition-all duration-300 text-left flex items-center justify-between"
                    >
                      <div className="relative z-10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {isSignUp
                            ? "Already registered?"
                            : "First time here?"}
                        </p>
                        <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {isSignUp
                            ? "Sign in to your account"
                            : "Create a new Customer Account"}
                        </p>
                      </div>
                      <div className="relative z-10 w-10 h-10 rounded-full bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-all duration-300">
                        <ChevronRight
                          size={20}
                          className="group-hover:translate-x-0.5 transition-transform"
                        />
                      </div>

                      {/* Hover Effect Background */}
                      <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                  </div>
                </form>
              )}

              {/* STAFF FORM */}
              {activeTab === "staff" && (
                <form
                  onSubmit={handleStaffLogin}
                  className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300 fill-mode-both"
                >
                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">
                      Work Email
                    </label>
                    <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail
                          size={18}
                          className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                        />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="username"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="admin@infofix.com"
                      />
                    </div>
                  </div>

                  <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 ml-1">
                      Password
                    </label>
                    <div className="relative transition-all duration-200 focus-within:transform focus-within:scale-[1.01]">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock
                          size={18}
                          className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"
                        />
                      </div>
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={staffPass}
                        onChange={(e) => setStaffPass(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group select-none">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-200 ${
                          rememberMe
                            ? "bg-indigo-600 border-indigo-600"
                            : "bg-white border-slate-300 group-hover:border-indigo-400"
                        }`}
                      >
                        {rememberMe && (
                          <CheckSquare size={12} className="text-white" />
                        )}
                      </div>
                      <span className="text-sm text-slate-600 font-medium group-hover:text-slate-800">
                        Remember me
                      </span>
                    </label>
                    <a
                      href="#"
                      className="text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      Forgot Password?
                    </a>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-shimmer opacity-20 pointer-events-none"></div>
                    {isLoading ? (
                      "Authenticating..."
                    ) : (
                      <>
                        <LogIn size={20} /> Access Dashboard
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
