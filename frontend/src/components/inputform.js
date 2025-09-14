import { useState } from "react";
import { toast } from "react-hot-toast";
import { generateResponse, evaluate } from "../api";

export default function InputForm({ onEvaluated }) {
  const [agent, setAgent] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");
    try {
      const res = await generateResponse(prompt);
      if (res.error) {
        setError(res.error);
        setResponse("");
        toast.error(res.error);
      } else {
        setResponse(res.response);
        toast.success("Response generated!");
      }
    } catch (e) {
      setError("Failed to connect to backend.");
      setResponse("");
      toast.error("Failed to connect to backend.");
    }
  };

  const handleEvaluate = async () => {
    setError("");
    try {
      const result = await evaluate(agent, prompt, response);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        onEvaluated(result);
        toast.success("Evaluation complete!");
      }
    } catch (e) {
      setError("Failed to connect to backend.");
      toast.error("Failed to connect to backend.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4 w-full">
        <input
          value={agent}
          onChange={e => setAgent(e.target.value)}
          placeholder="Agent Name"
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
        />
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Prompt"
          className="border border-gray-300 rounded-lg px-4 py-2 w-full md:w-2/3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
          rows={2}
        />
      </div>
      <div className="bg-gray-100 rounded-lg p-3 mt-2">
        <strong className="text-gray-700">Generated Response:</strong>
        <div className="border border-gray-200 rounded-lg p-2 min-h-[40px] bg-white mt-1">
          {error ? (
            <span className="text-red-500">{error}</span>
          ) : (
            response ? response : <span className="text-gray-400">No response yet.</span>
          )}
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-3 mt-2 w-full">
        <button
          type="button"
          onClick={handleGenerate}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-600 disabled:opacity-50 transition w-full md:w-auto"
        >
          Generate Response
        </button>
        <button
          type="button"
          onClick={handleEvaluate}
          disabled={!response}
          className="bg-green-500 text-white px-5 py-2 rounded-lg shadow hover:bg-green-600 disabled:opacity-50 transition w-full md:w-auto"
        >
          Evaluate
        </button>
      </div>
    </div>
  );
}
