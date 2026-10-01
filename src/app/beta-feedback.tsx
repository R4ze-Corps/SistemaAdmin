"use client";
import { createContext } from "react";

export const BetaFeedbackContext = createContext({ message: "", dismiss: () => {} });
