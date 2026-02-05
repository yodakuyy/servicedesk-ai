-- Add more specific Pending statuses
INSERT INTO public.ticket_statuses (status_name, status_description)
VALUES 
('Pending - Waiting for Vendor', 'Ticket is paused while waiting for external vendor or third-party support'),
('Pending - Waiting for Sparepart', 'Ticket is paused while waiting for parts or equipment delivery')
ON CONFLICT (status_name) DO NOTHING;
