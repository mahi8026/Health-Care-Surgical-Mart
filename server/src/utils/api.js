// API Helper
const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  console.log(`API Call: ${endpoint}`, { hasToken: !!token, config });

  const response = await fetch(`/api${endpoint}`, config);

  console.log(`API Response: ${endpoint}`, {
    status: response.status,
    contentType: response.headers.get("content-type"),
  });

  // Handle authentication errors
  if (response.status === 401) {
    console.log("Authentication failed, clearing localStorage and reloading");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
    return;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API Error");
  }

  return data;
};

// Export for use in other files
window.apiCall = apiCall;
