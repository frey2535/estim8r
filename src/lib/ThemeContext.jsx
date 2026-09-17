import React, { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext=createContext(null);
export function ThemeProvider({children}){const[theme,setTheme]=useState(()=>localStorage.getItem('estim8r-theme')||'system');useEffect(()=>{const dark=theme==='dark'||(theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);localStorage.setItem('estim8r-theme',theme)},[theme]);return <ThemeContext.Provider value={{theme,setTheme,toggleTheme:()=>setTheme(v=>v==='dark'?'light':'dark')}}>{children}</ThemeContext.Provider>}
export function useTheme(){const c=useContext(ThemeContext);if(!c)throw new Error('useTheme must be used within ThemeProvider');return c}
