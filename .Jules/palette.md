## 2025-10-26 - Dual-theme ActivityIndicator in NativeWind
**Learning:** `ActivityIndicator` color prop doesn't accept Tailwind classes directly. You must use `useColorScheme` hook to dynamically set the `color` prop based on theme state.
**Action:** Always import `useColorScheme` from `nativewind` when using `ActivityIndicator` in themed components.
