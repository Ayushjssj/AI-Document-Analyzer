import { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user")) || null
  );
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [aiTyping, setAiTyping] = useState(false);

  const getError = (error, fallback) => {
    if (error?.response?.data) {
      return error.response.data.error || error.response.data.msg || fallback;
    }
    return fallback;
  };

  const authHeader = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const registerUser = async () => {
    if (!name || !email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      await axios.post("http://127.0.0.1:5000/register", {
        name,
        email,
        password,
      });

      alert("Registration successful!");
      setIsLogin(true);
    } catch (error) {
      alert(getError(error, "Registration failed"));
    }
  };

  const loginUser = async () => {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      const res = await axios.post("http://127.0.0.1:5000/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setToken(res.data.token);
      setUser(res.data.user);

      alert("Login successful!");
    } catch (error) {
      alert(getError(error, "Login failed"));
    }
  };

  const forgotPassword = async () => {
    if (!forgotEmail || !newPassword) {
      alert("Please fill all fields");
      return;
    }

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/forgot-password",
        {
          email: forgotEmail,
          new_password: newPassword,
        }
      );

      alert(res.data.message);

      setShowForgot(false);
      setForgotEmail("");
      setNewPassword("");
    } catch (error) {
      alert(getError(error, "Password reset failed"));
    }
  };

  const logoutUser = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
  };

  const uploadFile = async () => {
    if (!file || file.length === 0) {
      alert("Please select files");
      return;
    }

    const formData = new FormData();

    for (let i = 0; i < file.length; i++) {
      formData.append("files", file[i]);
    }

    setLoading(true);

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/upload",
        formData,
        authHeader
      );

      setText(res.data.extracted_text);
      setSummary("");
      setChatHistory([]);

      alert("Files uploaded successfully!");
    } catch (error) {
      alert(getError(error, "Upload failed"));
    }

    setLoading(false);
  };

  const generateSummary = async () => {
    if (!text) {
      alert("Upload document first");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/summarize",
        {},
        authHeader
      );

      setSummary(res.data.summary);
    } catch (error) {
      alert(getError(error, "Summary failed"));
    }

    setLoading(false);
  };

  const askQuestion = async () => {
    if (!question.trim()) {
      return;
    }

    const userQuestion = question;

    setQuestion("");
    setAiTyping(true);

    try {
      const res = await axios.post(
        "http://127.0.0.1:5000/ask",
        {
          question: userQuestion,
        },
        authHeader
      );

      setChatHistory((prev) => [
        ...prev,
        {
          question: userQuestion,
          answer: res.data.answer,
        },
      ]);
    } catch (error) {
      alert(getError(error, "Question failed"));
    }

    setAiTyping(false);
  };

  const clearChat = () => {
    setChatHistory([]);
  };

  const removeFile = (indexToRemove) => {
    const updatedFiles = uploadedFiles.filter(
      (_, index) => index !== indexToRemove
    );

    setUploadedFiles(updatedFiles);
    setFile(updatedFiles);
  };

  if (!user) {
    return (
      <div className={darkMode ? "app dark" : "app light"}>
        <div className="auth-container">
          <div className="auth-card">
            <h1 className="auth-title">AI Document Analyzer</h1>

            <p className="auth-subtitle">
              {isLogin ? "Login to continue" : "Create your account"}
            </p>

            {!isLogin && (
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={isLogin ? loginUser : registerUser}>
              {isLogin ? "Login" : "Register"}
            </button>

            {isLogin && (
              <p
                className="forgot-link"
                onClick={() => setShowForgot(!showForgot)}
              >
                Forgot Password?
              </p>
            )}

            {showForgot && (
              <div className="forgot-box">
                <input
                  type="email"
                  placeholder="Enter registered email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />

                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />

                <button onClick={forgotPassword}>Reset Password</button>
              </div>
            )}

            <p className="auth-switch">
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}

              <span onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? " Register" : " Login"}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? "app dark" : "app light"}>
      {loading && (
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p>AI is processing your request...</p>
        </div>
      )}

      {/* LEFT SIDEBAR */}

      <div className="sidebar">
        <div>
          <h2>DocAI</h2>

          <button
            className="theme-btn"
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
          </button>

          <div className="sidebar-stats">
            <div className="stat-box">
              <h3>{uploadedFiles.length}</h3>
              <p>Files</p>
            </div>

            <div className="stat-box">
              <h3>{chatHistory.length}</h3>
              <p>Chats</p>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <p>Built by</p>
          <h4>Ayush Pandey</h4>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}

      <div className="right-sidebar">
        <h2>AI Tools</h2>

        <div className="right-card">
          <h3>📌 Features</h3>
          <p>PDF / DOCX Upload</p>
          <p>AI Summary</p>
          <p>Document Chat</p>
          <p>Multi-file Support</p>
        </div>

        <div className="right-card">
          <h3>⚡ Status</h3>
          <p>Backend: Active</p>
          <p>Authentication: Secure</p>
          <p>Model: Llama 3</p>
        </div>
      </div>

      {/* MAIN CONTENT */}

      <div className="main-content">
        <div className="topbar">
          <div>
            <h3>Welcome, {user.name}</h3>
            <p>{user.email}</p>
          </div>

          <button className="logout-btn" onClick={logoutUser}>
            Logout
          </button>
        </div>

        <div className="hero">
          <h1 className="main-heading">AI Document Analyzer</h1>

          <p>
            Upload PDF / DOCX files, generate AI summaries, and ask questions
            from your documents.
          </p>
        </div>

        <div className="container">
          {/* Upload */}

          <div className="card upload-card">
            <h2>Upload Document</h2>

            <input
              type="file"
              accept=".pdf,.docx"
              multiple
              onChange={(e) => {
                setFile(e.target.files);
                setUploadedFiles(Array.from(e.target.files));
              }}
            />

            <button onClick={uploadFile}>
              Upload & Extract Text
            </button>

            <div className="file-section">
              <h3>Uploaded Files ({uploadedFiles.length})</h3>

              {uploadedFiles.length === 0 ? (
                <p className="no-files">No files selected</p>
              ) : (
                uploadedFiles.map((file, index) => (
                  <div className="file-card" key={index}>
                    <div className="file-info">
                      📄 {file.name}
                    </div>

                    <button
                      className="remove-btn"
                      onClick={() => removeFile(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Extracted Text */}

          <div className="card">
            <h2>Extracted Text Preview</h2>

            <div className="text-box">
              {text
                ? text
                : "Uploaded document text will appear here..."}
            </div>
          </div>

          {/* Summary */}

          <div className="card">
            <h2>AI Summary</h2>

            <button onClick={generateSummary}>
              Generate Summary
            </button>

            <div className="result-box">
              {summary
                ? summary
                : "AI-generated summary will appear here..."}
            </div>
          </div>

          {/* Chat */}

          <div className="card chat-card">
            <h2>Chat With Document</h2>

            <input
              type="text"
              placeholder="Ask something from the document..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") askQuestion();
              }}
            />

            <button onClick={askQuestion}>
              Ask Question
            </button>

            {chatHistory.length > 0 && (
              <button
                className="clear-btn"
                onClick={clearChat}
              >
                Clear Chat
              </button>
            )}

            <div className="chat-history">
              {aiTyping && (
                <div className="typing-animation">
                  AI is typing...
                </div>
              )}

              {chatHistory.length === 0 ? (
                <p className="empty-chat">
                  Your chat history will appear here...
                </p>
              ) : (
                chatHistory.map((chat, index) => (
                  <div className="chat-message" key={index}>
                    <div className="user-msg">
                      <strong>You:</strong> {chat.question}
                    </div>

                    <div className="ai-msg">
                      <strong>AI:</strong> {chat.answer}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <footer className="footer">
          <p>
            © 2026 AI Document Analyzer | Author: Ayush Pandey
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;