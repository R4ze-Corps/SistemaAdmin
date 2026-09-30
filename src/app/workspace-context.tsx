"use client";
import { createContext, useContext } from "react";
export const WorkspaceContext = createContext({ mode: "production", documentPrefix: "reservas/" });
export const useWorkspace = () => useContext(WorkspaceContext);
