
import { Navigate, type RouteObject } from "react-router-dom";
import Layout from "../components/Layout";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Submit from "../pages/submit/page";
import Voting from "../pages/voting/page";
import Results from "../pages/results/page";
import ItemDetail from "../pages/item/page";
import Shop from "../pages/shop/page";
import ShopDetail from "../pages/shop/detail";
import Auction from "../pages/auction/page";
import Admin from "../pages/admin/page";

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/item/:id",
        element: <ItemDetail />,
      },
      {
        path: "/shop",
        element: <Shop />,
      },
      {
        path: "/shop/:id",
        element: <ShopDetail />,
      },
      {
        path: "/auction",
        element: <Auction />,
      },
      {
        path: "/submit",
        element: <Submit />,
      },
      {
        path: "/voting",
        element: <Voting />,
      },
      {
        path: "/results",
        element: <Results />,
      },
      {
        path: "/admin",
        element: <Admin />,
      },
      {
        path: "/admin/site",
        element: <Navigate to="/admin" replace />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

export default routes;
