import React, { useState, useRef } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { ChevronDown, X, Download } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useMinimizedStore } from '../../stores/minimizedStore';
import { KnowledgeArtifact } from '../../types/studio';
import { RichTextToolbar } from './RichTextToolbar';
import { EDITOR_HTML } from './EditorHtml';

interface Props {
  data: string; // The text content
  artifact: KnowledgeArtifact;
  onClose: () => void;
  onExport: () => void;
}

export const NoteViewer: React.FC<Props> = ({ data, artifact, onClose, onExport }) => {
  const { minimizeNote, closeNote } = useMinimizedStore();
  const [text, setText] = useState(data);
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  const webViewRef = useRef<WebView>(null);

  const handleMinimize = () => {
    // In a real app, update artifact.content with 'text' before minimizing
    minimizeNote(artifact);
    onClose();
  };

  const handleClose = () => {
    closeNote();
    onClose();
  };

  const handleStylePress = (style: string, value?: string) => {
      let command = style;
      if (style === 'color') command = 'foreColor';
      if (style === 'highlight') command = 'hiliteColor';

      // Inject JS to execute command
      const script = `
        handleMessage('${JSON.stringify({ type: 'format', command, value })}');
      `;
      webViewRef.current?.injectJavaScript(script);
  };

  const handleWebViewMessage = (event: any) => {
      try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'change') {
              setText(data.content);
          }
          if (data.type === 'selection') {
              setActiveStyles(data.styles || []);
          }
      } catch (e) {
          console.error('WebView message error:', e);
      }
  };

  const initialInjection = `
    handleMessage('${JSON.stringify({ type: 'init', content: data })}');
  `;

  return (
    <View className="flex-1 bg-space-dark">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/10 z-10 bg-space-dark">
          <Pressable onPress={handleMinimize} className="p-2 rounded-full active:bg-white/10">
              <ChevronDown color="#94a3b8" size={24} />
          </Pressable>

          <Text className="text-starlight font-bold text-lg flex-1 text-center" numberOfLines={1}>
              {artifact.title}
          </Text>

          <View className="flex-row gap-2">
              <Pressable onPress={onExport} className="p-2 rounded-full active:bg-white/10">
                  <Download color="#94a3b8" size={24} />
              </Pressable>
              <Pressable onPress={handleClose} className="p-2 rounded-full active:bg-white/10">
                  <X color="#ef4444" size={24} />
              </Pressable>
          </View>
      </View>

      {/* Editor Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
          <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: EDITOR_HTML }}
              onMessage={handleWebViewMessage}
              injectedJavaScript={initialInjection}
              style={{ backgroundColor: '#020617', flex: 1 }}
              containerStyle={{ flex: 1 }}
              scrollEnabled={true}
              hideKeyboardAccessoryView={true}
              keyboardDisplayRequiresUserAction={false}
              startInLoadingState={true}
              renderLoading={() => <View />}
              androidLayerType="software"
          />

          {/* Toolbar */}
          <RichTextToolbar onStylePress={handleStylePress} activeStyles={activeStyles} />
      </KeyboardAvoidingView>
    </View>
  );
};
