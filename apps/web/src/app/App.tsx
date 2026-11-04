import { HomePage } from '../pages/home';
import { CreateRoomPage } from '../pages/create';
import { JoinRoomPage } from '../pages/join';
import { RoomPage } from '../pages/room';
import { NotFoundPage } from '../pages/not-found';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join/:token" element={<JoinRoomPage />} />
          <Route path="/rooms/:id" element={<RoomPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
