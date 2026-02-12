import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Dimensions, ActivityIndicator, StatusBar } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, verticalScale, scale } from "react-native-size-matters/extend";
import { triggerHaptic } from "@/helpers/haptics";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { z } from "zod";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS (TanStack Query + Zod)
// ============================================================================
import { 
  useComments, 
  usePostComment,
  type Comment 
} from "@/services/mavin/engagement/EngagementEngine";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// ============================================================================
// ZOD VALIDATION (Type Safety)
// ============================================================================
const CommentInputSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty").max(500, "Comment too long"),
  language: z.string().default("en"),
});

// ============================================================================
// REUSABLE COMMENT COMPONENT (Unified Design)
// ============================================================================
const CommentItem = ({ comment, isOwnComment = false }: { comment: any; isOwnComment?: boolean }) => {
  // Generate consistent usernames for YouTube comments
  const displayName = comment.author || `User${Math.floor(Math.random() * 10000)}`;
  
  // Format timestamp consistently
  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <View style={styles.commentAuthorSection}>
          <View style={styles.commentAvatar}>
            <MaterialCommunityIcons 
              name="account-circle" 
              size={moderateScale(28)} 
              color={isOwnComment ? "#FFD700" : "rgba(255,255,255,0.5)"} 
            />
          </View>
          <View>
            <Text style={[
              styles.commentAuthor,
              isOwnComment && styles.ownCommentAuthor
            ]}>
              {isOwnComment ? "You" : displayName}
            </Text>
            <Text style={styles.commentTime}>{getTimeAgo(comment.timestamp)}</Text>
          </View>
        </View>
        {isOwnComment && (
          <TouchableOpacity onPress={() => {}}>
            <MaterialCommunityIcons name="dots-vertical" size={moderateScale(18)} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.commentText}>{comment.text}</Text>
      
      <View style={styles.commentFooter}>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <MaterialCommunityIcons name="thumb-up-outline" size={moderateScale(16)} color="rgba(255,255,255,0.7)" />
            <Text style={styles.actionText}>
              {comment.likes?.toLocaleString() || "0"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <MaterialCommunityIcons name="thumb-down-outline" size={moderateScale(16)} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          {isOwnComment && (
            <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
              <MaterialCommunityIcons name="delete-outline" size={moderateScale(16)} color="#FF4081" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// COMMENTS MODAL (Seamless Integration)
// ============================================================================
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CommentsModal = () => {
  const router = useRouter();
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const { top } = useSafeAreaInsets();
  const { gracePeriodStatus, isPremium } = useGracePeriod();
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // ============================================================================
  // ENGINE HOOKS (TanStack Query Powered)
  // ============================================================================
  const { 
    commentsData, 
    isLoading, 
    refetch,
    isRefetching 
  } = useComments(songId || "", true);
  
  const { mutate: postComment, isPending: isPostingComment } = usePostComment();

  // Auto-focus input on mount (premium/grace period users)
  useEffect(() => {
    if (isPremium || gracePeriodStatus === 'grace_period') {
      inputRef.current?.focus();
    }
  }, [isPremium, gracePeriodStatus]);

  // ============================================================================
  // COMMENT POSTING (Frictionless)
  // ============================================================================
  const handlePostComment = useCallback(async () => {
    if (!songId || !inputText.trim()) return;
    
    try {
      const validated = CommentInputSchema.parse({ 
        text: inputText.trim(),
        language: "en"
      });
      
      triggerHaptic("light");
      
      await postComment({
        songId,
        text: validated.text,
        language: validated.language
      });
      
      setInputText("");
      flatListRef.current?.scrollToEnd({ animated: true });
      triggerHaptic("success");
    } catch (error) {
      const mavinError = errorFromUnknown(error);
      
      if (mavinError.message.includes("empty")) {
        triggerHaptic("error");
        alert("Comment cannot be empty");
      } else if (mavinError.message.includes("too long")) {
        triggerHaptic("error");
        alert("Comment is too long (max 500 characters)");
      } else {
        logError(mavinError, "error");
        triggerHaptic("error");
        alert("Failed to post comment. Please try again.");
      }
    }
  }, [songId, inputText, postComment]);

  // ============================================================================
  // RENDERING OPTIMIZATIONS - SEAMLESS BLEND
  // ============================================================================
  const allComments = useMemo(() => {
    if (!commentsData) return [];
    
    // Get current user's comment IDs from app comments
    const userCommentIds = new Set(
      commentsData.appComments.map((c: Comment) => c.id)
    );
    
    // Transform YouTube comments to match app comment format
    const youtubeAsAppComments = commentsData.youtubeComments.map((comment: any, index: number) => ({
      id: `ext-${Date.now()}-${index}`,
      text: comment.text,
      author: comment.author,
      timestamp: comment.timestamp,
      likes: comment.likes || Math.floor(Math.random() * 100),
      isYouTube: true
    }));
    
    // Transform app comments
    const appComments = commentsData.appComments.map((comment: Comment) => ({
      ...comment,
      isOwn: true,
      timestamp: comment.timestamp || Date.now()
    }));
    
    // Combine and sort by timestamp (newest first)
    const all = [...youtubeAsAppComments, ...appComments]
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return all.map(item => ({
      id: item.id,
      type: "comment" as const,
      data: item,
      isOwn: !!item.isOwn
    }));
  }, [commentsData]);

  // ============================================================================
  // LIST RENDERING
  // ============================================================================
  const renderCommentItem = useCallback(({ item }: { item: any }) => {
    return (
      <CommentItem 
        comment={item.data} 
        isOwnComment={item.isOwn} 
      />
    );
  }, []);

  // ============================================================================
  // EMPTY STATES
  // ============================================================================
  if (isLoading && !commentsData) {
    return (
      <View style={[defaultStyles.container, styles.loadingContainer]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  if (!commentsData || (commentsData.youtubeComments.length === 0 && commentsData.appComments.length === 0)) {
    return (
      <View style={[defaultStyles.container, styles.emptyContainer]}>
        <MaterialCommunityIcons name="comment-off-outline" size={moderateScale(64)} color="rgba(255,255,255,0.3)" />
        <Text style={styles.emptyTitle}>No comments yet</Text>
        <Text style={styles.emptyText}>Be the first to share your thoughts!</Text>
      </View>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <View style={[defaultStyles.container, styles.container]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: top + verticalScale(12) }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            triggerHaptic("light");
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={moderateScale(28)} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Comments</Text>
          <Text style={styles.headerSubtitle}>
            {allComments.length} comments
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => refetch()}
          disabled={isRefetching}
        >
          <Ionicons 
            name={isRefetching ? "refresh-outline" : "refresh"} 
            size={moderateScale(22)} 
            color={isRefetching ? "rgba(255,255,255,0.5)" : "#fff"} 
          />
        </TouchableOpacity>
      </View>

      {/* COMMENTS LIST - SEAMLESS INTEGRATION */}
      <FlatList
        ref={flatListRef}
        data={allComments}
        renderItem={renderCommentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => (
          <View style={styles.listFooter}>
            {isRefetching && (
              <ActivityIndicator color={Colors.primary} style={styles.footerLoader} />
            )}
          </View>
        )}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />

      {/* COMMENT INPUT */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="Add a comment..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isPostingComment}
            onSubmitEditing={handlePostComment}
            returnKeyType="send"
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isPostingComment) && styles.sendButtonDisabled
            ]}
            onPress={handlePostComment}
            disabled={!inputText.trim() || isPostingComment}
          >
            {isPostingComment ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="send" size={moderateScale(20)} color="#000" />
            )}
          </TouchableOpacity>
        </View>
        
        <Text style={styles.charCounter}>
          {inputText.length}/500
          {inputText.length > 450 && inputText.length <= 500 && (
            <Text style={styles.charWarning}> (almost there!)</Text>
          )}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES (Unified Design System)
// ============================================================================
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    paddingTop: 0,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: verticalScale(16),
    fontSize: moderateScale(16),
    opacity: 0.7,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    color: "#fff",
    fontSize: moderateScale(20),
    fontWeight: "700",
    marginTop: verticalScale(24),
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: moderateScale(14),
    marginTop: verticalScale(8),
    textAlign: "center",
    lineHeight: moderateScale(20),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  closeButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: moderateScale(18),
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: moderateScale(12),
    marginTop: verticalScale(2),
  },
  headerAction: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(16),
  },
  commentItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: verticalScale(12),
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: verticalScale(8),
  },
  commentAuthorSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  commentAvatar: {
    marginRight: scale(10),
  },
  commentAuthor: {
    color: "#fff",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  ownCommentAuthor: {
    color: "#FFD700",
  },
  commentTime: {
    color: "rgba(255,255,255,0.5)",
    fontSize: moderateScale(11),
    marginTop: verticalScale(1),
  },
  commentText: {
    color: "#fff",
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(8),
  },
  commentFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: verticalScale(8),
  },
  commentActions: {
    flexDirection: "row",
    gap: scale(16),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  actionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: moderateScale(12),
  },
  listFooter: {
    height: verticalScale(20),
    justifyContent: "center",
    alignItems: "center",
  },
  footerLoader: {
    marginTop: verticalScale(8),
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    padding: scale(16),
    backgroundColor: "#000",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: scale(10),
  },
  textInput: {
    flex: 1,
    color: "#fff",
    fontSize: moderateScale(15),
    minHeight: verticalScale(40),
    maxHeight: verticalScale(100),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: scale(12),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sendButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(212, 175, 55, 0.3)",
  },
  charCounter: {
    color: "rgba(255,255,255,0.6)",
    fontSize: moderateScale(11),
    marginTop: verticalScale(6),
    textAlign: "right",
  },
  charWarning: {
    color: "#FFA500",
  },
});

export default CommentsModal;