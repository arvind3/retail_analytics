const Skeleton = ({ height = '240px' }: { height?: string }) => (
  <div className="skeleton w-full rounded-2xl" style={{ height }} />
);

export default Skeleton;
