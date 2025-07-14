// ============================================================================
// UI ICONS (Extracted from constants.tsx after LangGraph Migration)
// ============================================================================
// All SVG icon components used throughout the frontend UI

import React from 'react';

export const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
  </svg>
);

export const PauseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
  </svg>
);

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
  </svg>
);

export const NextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

export const PreviousIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 0-1.06 0L6.47 9.47a.75.75 0 0 0 0 1.06l4.25 4.25a.75.75 0 0 0 1.06-1.06L8.06 10l3.72-3.72a.75.75 0 0 0 0-1.06z" clipRule="evenodd" />
  </svg>
);

export const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M9.25 13.25a.75.75 0 001.5 0V4.793l2.969 2.97a.75.75 0 001.06-1.06l-4.25-4.25a.75.75 0 00-1.06 0L5.22 6.704a.75.75 0 001.06 1.06L9.25 4.793V13.25z" />
    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
  </svg>
);

export const LoadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v1.272A2.228 2.228 0 0 0 3.75 6h12.5A2.228 2.228 0 0 0 18 6.022V4.75A1.75 1.75 0 0 0 16.25 3h-4.835a.25.25 0 0 1-.202-.098L10.5 2.016a.25.25 0 0 0-.202-.098H3.75zM2 9.75A1.75 1.75 0 0 1 3.75 8h12.5A1.75 1.75 0 0 1 18 9.75v5.5A1.75 1.75 0 0 1 16.25 17H3.75A1.75 1.75 0 0 1 2 15.25v-5.5z" />
  </svg>
);

export const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M2.5 2.5A2.5 2.5 0 0 0 0 5v10a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 20 15V5a2.5 2.5 0 0 0-2.5-2.5H15V.75a.75.75 0 0 0-1.5 0V2.5H6.5V.75a.75.75 0 0 0-1.5 0V2.5H2.5zM3.5 15V7h13v8a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1zM7 9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H7z" />
  </svg>
);

export const LightbulbIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M9.05 3.296a6.5 6.5 0 0 1 1.903 0l.536.216a.75.75 0 0 0 .86.095A6.476 6.476 0 0 1 16 9.5c0 1.598-.595 3.036-1.581 4.148a.75.75 0 0 0 .205 1.118l.26.173c.182.121.38.223.59.309a.75.75 0 0 1 .318 1.006A6.5 6.5 0 0 1 9.051 3.296zM5.556 14.898A.75.75 0 0 0 6 14.5V11a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 .556.725zM14.444 14.898a.75.75 0 0 1-.556-.725V11a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.556.725zM10 17.5a.75.75 0 0 0 .75-.75V14h-1.5v2.75a.75.75 0 0 0 .75.75zM3.823 10.992a.75.75 0 0 1 1.006-.318c.21-.086.408-.188.59-.309l.26-.173a.75.75 0 0 1 .206-1.118A4.983 4.983 0 0 0 4 9.5a4.978 4.978 0 0 0-2.455-4.382.75.75 0 0 1-.095-.86l.216-.536a6.503 6.503 0 0 1 10.668 0l.216.536a.75.75 0 0 1-.095.86A4.979 4.979 0 0 0 12 9.5c0 .052.001.104.004.155a.75.75 0 0 1-1.498.09A3.5 3.5 0 0 0 10 9.498V9.5a3.5 3.5 0 0 0-3.418 3.072.75.75 0 0 1-1.006.318A6.522 6.522 0 0 1 3.823 10.992z"/>
  </svg>
);

export const FileTextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6.707A2.25 2.25 0 0017.328 5L14 1.672A2.25 2.25 0 0012.293 1H5.707A2.25 2.25 0 004 2zm.75 4.75A.75.75 0 015.5 6h9a.75.75 0 010 1.5h-9A.75.75 0 014.75 6.75zM4.75 9.25A.75.75 0 015.5 8.5h9a.75.75 0 010 1.5h-9A.75.75 0 014.75 9.25zm0 2.5A.75.75 0 015.5 11h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.45a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" clipRule="evenodd" />
  </svg>
);

export const CheckCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
  </svg>
);

export const InfoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-75" {...props}>
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
  </svg>
);

export const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

export const ChevronUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M14.78 11.78a.75.75 0 01-1.06 0L10 8.06l-3.72 3.72a.75.75 0 11-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06z" clipRule="evenodd" />
  </svg>
);

export const RetryIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M15.323 10.243a5.25 5.25 0 00-7.815-1.11L6.06 7.677a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l2.25-2.25a.75.75 0 00-1.06-1.06l-1.274 1.273A3.75 3.75 0 0113.5 7.5c1.657 0 3.073 1.075 3.55 2.578a.75.75 0 001.45-.358A5.25 5.25 0 0015.323 10.243zM4.677 9.757a5.25 5.25 0 007.815 1.11l1.448 1.448a.75.75 0 001.06-1.06l-2.25-2.25a.75.75 0 00-1.06 0l-2.25 2.25a.75.75 0 101.06 1.06l1.274-1.273A3.75 3.75 0 016.5 12.5c-1.657 0-3.073-1.075-3.55-2.578a.75.75 0 00-1.45.358A5.25 5.25 0 004.677 9.757z" clipRule="evenodd" />
  </svg>
);

export const AppendixIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M3 3.75A.75.75 0 013.75 3h12.5a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V3.75zm0-1.5A2.25 2.25 0 00.75 3.75v12.5c0 1.243 1.007 2.25 2.25 2.25h12.5A2.25 2.25 0 0018.5 16.25V3.75A2.25 2.25 0 0016.25 1.5H3.75z" clipRule="evenodd" />
    <path d="M5.023 6.958A.75.75 0 015.75 6.5h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.727-.542zM5.023 9.958A.75.75 0 015.75 9.5h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.727-.542zM5.75 12.5a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" />
  </svg>
);

export const MoonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
  </svg>
);

export const SunIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" {...props}>
    <path d="M10 3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 3ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM15.606 5.494a.75.75 0 0 1 .093 1.057l-1.06 1.06a.75.75 0 0 1-1.057-.093A5.005 5.005 0 0 0 10 7.5a.75.75 0 0 1-1.5 0c0-1.604.864-3.018 2.182-3.875a.75.75 0 0 1 1.057.093l1.06 1.06a.75.75 0 0 1 .093 1.057ZM4.394 14.506a.75.75 0 0 1-.093-1.057l1.06-1.06a.75.75 0 0 1 1.057.093A5.005 5.005 0 0 0 10 12.5a.75.75 0 0 1 1.5 0c0 1.604-.864 3.018-2.182 3.875a.75.75 0 0 1-1.057-.093l-1.06-1.06a.75.75 0 0 1-.093-1.057ZM17.25 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM4.75 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75ZM14.506 15.606a.75.75 0 0 1-1.057-.093A5.005 5.005 0 0 0 12.5 10a.75.75 0 0 1 0-1.5c1.604 0 3.018.864 3.875 2.182a.75.75 0 0 1-.093 1.057l-1.06 1.06a.75.75 0 0 1-1.057.093ZM5.494 4.394a.75.75 0 0 1 1.057.093A5.005 5.005 0 0 0 7.5 10a.75.75 0 0 1 0 1.5c-1.604 0-3.018-.864-3.875-2.182a.75.75 0 0 1 .093 1.057l1.06-1.06a.75.75 0 0 1 1.057-.093ZM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
  </svg>
);