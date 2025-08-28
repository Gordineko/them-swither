import React from "react";

const SearchIcon = ({ active }) => {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17 17L13.1422 13.1422"
        stroke="#FAFAFA"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M8.1111 15.2222C12.0384 15.2222 15.2222 12.0385 15.2222 8.11111C15.2222 4.18375 12.0384 1 8.1111 1C4.18375 1 1 4.18375 1 8.11111C1 12.0385 4.18375 15.2222 8.1111 15.2222Z"
        stroke="#FAFAFA"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

export default SearchIcon;
