
import React, { useState, useRef, useEffect } from "react";
import context from './dbContext/context.json'

const webhookUrl = import.meta.env.VITE_WEBHOOK_URL;

const QueryUI = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "ai",
      text: "Hello! I am your AI Mongo Assistant. Ask me anything about your database, and I will fetch the records for you.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userQuery = query.trim();
    setQuery("");

    const userMessageId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, sender: "user", text: userQuery },
    ]);

    setLoading(true);

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: userQuery, context:context}),
      });

      const data = await res.json();

      // Normalize Case: If it's an array with a single wrapped message object
      const isWrappedMessage = 
        Array.isArray(data) && 
        data.length === 1 && 
        data[0] !== null &&
        typeof data[0] === "object" && 
        "responseMessage" in data[0];

      // Target Payload Extraction
      const activePayload = isWrappedMessage ? data[0] : data;

      // CASE 1: Response is an Array of multiple data records (or single record that isn't a status response)
      if (Array.isArray(activePayload) && activePayload.length > 0 && typeof activePayload[0] === "object" && activePayload[0] !== null) {
        const columns = Object.keys(activePayload[0]).map((key) => ({
          field: key,
          headerName: key.charAt(0).toUpperCase() + key.slice(1),
        }));

        const rows = activePayload.map((item, index) => ({
          id: item.id || item._id || `row-${index}`,
          ...item,
        }));

        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-reply`,
            sender: "ai",
            text: `Successfully executed. Found ${rows.length} matching documents inside the collection.`,
            dataset: { columns, rows },
          },
        ]);
      } 
      // CASE 2: Response is a status message object (Directly or Unwrapped from Array)
      else if (activePayload && typeof activePayload === "object" && "responseMessage" in activePayload) {
        const isErrorResponse = activePayload.responseCode >= 400;
        
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-reply`,
            sender: "ai",
            text: activePayload.responseMessage || "Action completed with no text confirmation returned.",
            isError: isErrorResponse,
          },
        ]);
      } 
      // CASE 3: Unhandled structures
      else {
        throw new Error("Invalid payload pipeline structure parsed.");
      }
    } catch (err) {
      console.error("Query Execution Failure:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          sender: "ai",
          text: "Query runtime execution failed. The server returned an empty dataset or an unresolvable data payload pipeline error.",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] mt-20 max-w-6xl mx-auto bg-slate-50 border border-slate-200 shadow-xl rounded-xl overflow-hidden my-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-semibold shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Mongo AI Explorer</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              Connected to Pipeline
            </p>
          </div>
        </div>
      </div>

      {/* Chat Space */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 max-w-4xl ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0 shadow-sm
              ${msg.sender === "user" ? "bg-slate-800 text-white" : msg.isError ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}
            >
              {msg.sender === "user" ? "US" : "MA"}
            </div>

            <div className={`flex flex-col gap-2 ${msg.sender === "user" ? "items-end" : "items-start"} w-full`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm max-w-xl
                ${msg.sender === "user" 
                  ? "bg-slate-800 text-slate-100 rounded-tr-none" 
                  : msg.isError 
                    ? "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none" 
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none"}`}
              >
                {msg.text}
              </div>

              {/* Dynamic Native Flex-Table Data View */}
              {msg.dataset && (
                <div className="w-full max-w-full mt-2 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 uppercase tracking-wider">
                          {msg.dataset.columns.map((col) => (
                            <th key={col.field} className="px-4 py-3 whitespace-nowrap font-medium">
                              {col.headerName}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {msg.dataset.rows.map((row, idx) => (
                          <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}>
                            {msg.dataset.columns.map((col) => (
                              <td key={col.field} className="px-4 py-2.5 whitespace-nowrap font-mono max-w-xs truncate">
                                {typeof row[col.field] === "object" 
                                  ? JSON.stringify(row[col.field]) 
                                  : String(row[col.field] ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                    Returned {msg.dataset.rows.length} rows
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-4 mr-auto max-w-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-medium shadow-sm">
              AI
            </div>
            <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Action Panel */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSearch} className="flex gap-3 max-w-4xl mx-auto relative items-center">
          <input
            type="text"
            className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm rounded-xl pl-4 pr-14 py-3.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition-all duration-200"
            placeholder="Query database (e.g., find users where active metrics match...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="absolute right-2 p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-300 transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default QueryUI;

