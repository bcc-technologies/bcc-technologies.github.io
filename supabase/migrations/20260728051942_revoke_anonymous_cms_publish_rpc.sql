-- Legacy role grants can outlive a PUBLIC revoke; make anonymous execution explicit.
revoke all on function public.publish_cms_post(text) from anon;
