function ModalCloseButton({ onClick, inline = false, className = "" }) {
  const classes = [
    "app-modal-close",
    inline ? "app-modal-close--inline" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} onClick={onClick} aria-label="Close">
      <svg className="app-modal-close__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export default ModalCloseButton;
