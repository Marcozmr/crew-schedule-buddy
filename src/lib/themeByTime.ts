export function getThemeByLocalTime(): 'light' | 'dark' {
    const now = new Date();
    const hour = now.getHours();
  
    if (hour >= 6 && hour < 18) {
      return 'light';
    }
  
    return 'dark';
  }