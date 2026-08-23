import { useEffect } from 'react';

/**
 * Custom hook to dynamically update document title using the format:
 * "[Nama Page] | Waschen Laundry"
 * 
 * @param {string} pageTitle - Name of the page (e.g. 'Home', 'Dashboard', 'Login')
 */
export const useDocumentTitle = (pageTitle) => {
  useEffect(() => {
    if (pageTitle) {
      document.title = `${pageTitle} | Waschen Laundry`;
    } else {
      document.title = 'Home | Waschen Laundry';
    }
  }, [pageTitle]);
};

export default useDocumentTitle;
