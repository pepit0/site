import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { SiteLayout } from "./layout/SiteLayout";
import { AboutPage } from "./pages/AboutPage";
import { AdminBlogPage } from "./pages/AdminBlogPage";
import { AdminCalculatorPage } from "./pages/AdminCalculatorPage";
import { AdminInventoryPage } from "./pages/AdminInventoryPage";
import { AdminMarketplaceCompPage } from "./pages/AdminMarketplaceCompPage";
import { ContactPage } from "./pages/ContactPage";
import { FaqPage } from "./pages/FaqPage";
import { BlogHubPage } from "./pages/BlogHubPage";
import { BlogPostPage } from "./pages/BlogPostPage";
import { FinancingHubPage } from "./pages/FinancingHubPage";
import { FinancingLandingPage } from "./pages/FinancingLandingPage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { InventoryUnitDetailPage } from "./pages/InventoryUnitDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { PaymentCalculatorPage } from "./pages/PaymentCalculatorPage";
import { PreApprovalCompletePage } from "./pages/PreApprovalCompletePage";
import { PreApprovalPage } from "./pages/PreApprovalPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { SellYourRideApplyPage } from "./pages/SellYourRideApplyPage";
import { SellYourRidePage } from "./pages/SellYourRidePage";
import { StaffPage } from "./pages/StaffPage";
import { isMarketingOnlySite } from "./siteMode";

export default function App() {
  const marketingOnly = isMarketingOnlySite();

  return (
    <Routes>
      <Route path="/" element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="home-preview" element={<Navigate to="/" replace />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/:unitId" element={<InventoryUnitDetailPage />} />
        <Route path="sell-your-ride" element={<SellYourRidePage />} />
        <Route path="sell-your-ride/apply" element={<SellYourRideApplyPage />} />
        <Route path="apply" element={<PreApprovalPage />} />
        <Route path="apply/complete" element={<PreApprovalCompletePage />} />
        <Route path="financing" element={<FinancingHubPage />} />
        <Route path="financing/:slug" element={<FinancingLandingPage />} />
        <Route path="blog" element={<BlogHubPage />} />
        <Route path="blog/:slug" element={<BlogPostPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="payment-calculator" element={<PaymentCalculatorPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="admin" element={<Navigate to="/admin/inventory" replace />} />
        <Route
          path="admin/inventory"
          element={
            <ProtectedRoute requireCrm={false} requireInventoryAdmin>
              <AdminInventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/calculator"
          element={
            <ProtectedRoute requireCrm={false} requireInventoryAdmin>
              <AdminCalculatorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/marketplace-comps"
          element={
            <ProtectedRoute requireCrm={false} requireInventoryAdmin>
              <AdminMarketplaceCompPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/blog"
          element={
            <ProtectedRoute requireCrm={false} requireInventoryAdmin>
              <AdminBlogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/sell-queue"
          element={
            <ProtectedRoute requireCrm={false} requireInventoryAdmin>
              <Navigate to="/admin/inventory?tab=sell" replace />
            </ProtectedRoute>
          }
        />
        {marketingOnly ? (
          <Route path="staff" element={<Navigate to="/" replace />} />
        ) : (
          <Route
            path="staff"
            element={
              <ProtectedRoute>
                <StaffPage />
              </ProtectedRoute>
            }
          />
        )}
      </Route>
    </Routes>
  );
}
