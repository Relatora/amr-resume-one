// Applies the saved theme before React hydrates, to avoid a flash.
try {
  if (localStorage.getItem("resume-theme") === "light") {
    document.documentElement.classList.add("light");
  }
} catch {
  // storage unavailable - default theme applies
}
