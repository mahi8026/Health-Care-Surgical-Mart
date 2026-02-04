import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import bulkProductService from "../services/bulkProductService";
import LoadingSpinner from "../components/LoadingSpinner";

const BulkProductImport = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedImport, setSelectedImport] = useState(nul