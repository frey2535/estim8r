-- Private estimate-photo bucket. Company members may access only their org prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estim8r-estimate-photos','estim8r-estimate-photos',false,15728640,
array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "estim8r company photo read" on storage.objects for select to authenticated
using (bucket_id = 'estim8r-estimate-photos' and (storage.foldername(name))[1] =
(select org_id::text from public.profiles where id = auth.uid()));

create policy "estim8r company photo upload" on storage.objects for insert to authenticated
with check (bucket_id = 'estim8r-estimate-photos' and (storage.foldername(name))[1] =
(select org_id::text from public.profiles where id = auth.uid()));

create policy "estim8r company photo delete" on storage.objects for delete to authenticated
using (bucket_id = 'estim8r-estimate-photos' and (storage.foldername(name))[1] =
(select org_id::text from public.profiles where id = auth.uid()));
