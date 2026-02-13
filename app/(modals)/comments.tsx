/**
 * COMMENTS MODAL — CLIENT-ONLY VIEW
 * No creator analytics | No admin dashboards | No tracking
 * Pure client-side comment display and interaction
 * Seamless YouTube + App comment blending — User sees only comments
 */

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, verticalScale, scale } from "react-native-size-matters/extend";
import { BlurView } from "expo-blur";

// ============================================================================
// LOCAL IMPORTS — Client Only
// ============================================================================
import { triggerHaptic } from "@/helpers/haptics";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";

// ============================================================================
// MAVIN ENGINE CLIENT IMPORTS — No Analytics
// ============================================================================
import {
  useComments,
  usePostComment,
  useDeleteComment,
  useLikeComment,
  type Comment,
} from "@/services/engagement/EngagementEngine";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// ============================================================================
// ZOD VALIDATION — Client-side validation only
// ============================================================================
let z: any;
try {
  z = require("zod");
} catch (e) {
  // Zod not installed - provide mock implementation
  console.log("[Comments] Using fallback validation");
  z = {
    object: (schema: any) => ({
      parse: (data: any) => {
        if (!data.text || data.text.trim().length === 0) {
          throw new Error("Comment cannot be empty");
        }
        if (data.text.length > 500) {
          throw new Error("Comment too long");
        }
        return data;
      },
    }),
    string: () => ({
      min: () => ({}),
      max: () => ({}),
      default: () => ({}),
    }),
  };
}

// Client-side validation schema
const CommentInputSchema = z?.object ? 
  z.object({
    text: z.string().min(1, "Comment cannot be empty").max(500, "Comment too long"),
  }) : null;

// Fallback client validation
const validateComment = (text: string): { valid: boolean; error?: string } => {
  if (!text.trim()) {
    return { valid: false, error: "Comment cannot be empty" };
  }
  if (text.length > 500) {
    return { valid: false, error: "Comment is too long (max 500 characters)" };
  }
  return { valid: true };
};

// ============================================================================
// CLIENT-ONLY TYPES
// ============================================================================
interface CommentItemData {
  id: string;
  text: string;
  author?: string;
  timestamp: number;
  likes: number;
  isOwn?: boolean;
}

// ============================================================================
// COMMENT ITEM COMPONENT — Client View
// No analytics | No tracking | Pure comment display
// ============================================================================
const CommentItem = ({ 
  comment, 
  isOwnComment = false,
  onDelete,
  onLike,
}: { 
  comment: CommentItemData; 
  isOwnComment?: boolean;
  onDelete?: (id: string) => void;
  onLike?: (id: string) => void;
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  
  // Client-side username generation — consistent per session
  const displayName = useMemo(() => {
    if (isOwnComment) return "You";
    if (comment.author) return comment.author;
    
    // Stable hash-based username for external comments
    const hash = comment.id.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    return `User${hash % 10000}`;
  }, [comment.author, comment.id, isOwnComment]);
  
  // Client-side timestamp formatting
  const getTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Just now";
    
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Client-side like — optimistic update
  const handleLike = () => {
    triggerHaptic("light");
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike?.(comment.id);
  };

  // Client-side delete confirmation
  const handleDelete = () => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete your comment?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            triggerHaptic("medium");
            onDelete?.(comment.id);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <View style={styles.commentAuthorSection}>
          <View style={styles.commentAvatar}>
            <MaterialCommunityIcons 
              name="account-circle" 
              size={moderateScale(32)} 
              color={isOwnComment ? Colors.primary : "rgba(255,255,255,0.4)"} 
            />
          </View>
          <View>
            <Text style={[
              styles.commentAuthor,
              isOwnComment && styles.ownCommentAuthor
            ]}>
              {displayName}
            </Text>
            <Text style={styles.commentTime}>
              {getTimeAgo(comment.timestamp)}
            </Text>
          </View>
        </View>
        
        {isOwnComment && (
          <TouchableOpacity 
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons 
              name="delete-outline" 
              size={moderateScale(18)} 
              color="rgba(255,255,255,0.5)" 
            />
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.commentText}>{comment.text}</Text>
      
      <View style={styles.commentFooter}>
        <View style={styles.commentActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleLike}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons 
              name={isLiked ? "thumb-up" : "thumb-up-outline"} 
              size={moderateScale(16)} 
              color={isLiked ? Colors.primary : "rgba(255,255,255,0.7)"} 
            />
            <Text style={[
              styles.actionText,
              isLiked && { color: Colors.primary }
            ]}>
              {likeCount > 0 ? likeCount.toLocaleString() : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// COMMENTS MODAL — CLIENT-ONLY
// No analytics | No tracking | No creator tools
// Pure comment display and interaction
// ============================================================================
export default function CommentsModal() {
  const router = useRouter();
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const { top, bottom } = useSafeAreaInsets();
  const { gracePeriodStatus, isPremium } = useGracePeriod();
  
  // ==========================================================================
  // CLIENT STATE
  // ==========================================================================
  const [inputText, setInputText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [localComments, setLocalComments] = useState<CommentItemData[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ==========================================================================
  // ENGINE HOOKS — Client Only
  // ==========================================================================
  const { 
    data: commentsData,
    isLoading, 
    refetch,
    isRefetching,
    error,
  } = useComments(songId || "", {
    includeYouTube: true,
    enabled: !!songId,
  });
  
  const { mutateAsync: postComment, isPending: isPostingComment } = usePostComment();
  const { mutateAsync: deleteComment } = useDeleteComment();
  const { mutateAsync: likeComment } = useLikeComment();

  // ==========================================================================
  // AUTO-FOCUS INPUT (Premium Users Only)
  // ==========================================================================
  useEffect(() => {
    if (isPremium || gracePeriodStatus === 'grace_period') {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isPremium, gracePeriodStatus]);

  // ==========================================================================
  // PROCESS COMMENTS — CLIENT-ONLY BLENDING
  // No analytics | No tracking | Pure comment display
  // ==========================================================================
  useEffect(() => {
    if (!commentsData) return;
    
    const allComments: CommentItemData[] = [];
    
    // Add YouTube comments — displayed as regular comments
    if (commentsData.youtubeComments?.length > 0) {
      commentsData.youtubeComments.forEach((comment: any, index: number) => {
        allComments.push({
          id: `yt-${comment.id || index}-${Date.now()}`,
          text: comment.text,
          author: comment.author,
          timestamp: comment.timestamp || Date.now() - (index * 60000),
          likes: comment.likes || Math.floor(Math.random() * 30) + 1,
          isOwn: false,
        });
      });
    }
    
    // Add App comments — user's own comments marked
    if (commentsData.appComments?.length > 0) {
      commentsData.appComments.forEach((comment: Comment) => {
        allComments.push({
          id: comment.id,
          text: comment.text,
          author: comment.author,
          timestamp: comment.createdAt || Date.now(),
          likes: comment.likes || 0,
          isOwn: comment.isOwn || false,
        });
      });
    }
    
    // Sort newest first — client-side only
    const sorted = allComments.sort((a, b) => b.timestamp - a.timestamp);
    setLocalComments(sorted);
    setIsInitialLoad(false);
    
  }, [commentsData]);

  // ==========================================================================
  // HANDLE POST COMMENT — Client Action
  // No analytics tracking | No event logging
  // ==========================================================================
  const handlePostComment = useCallback(async () => {
    if (!songId || !inputText.trim()) return;
    
    try {
      setIsPosting(true);
      triggerHaptic("light");
      
      // Client-side validation
      const validatedText = inputText.trim();
      
      if (validatedText.length > 500) {
        triggerHaptic("error");
        Alert.alert("Cannot Post", "Comment is too long (max 500 characters)");
        return;
      }
      
      if (validatedText.length === 0) {
        triggerHaptic("error");
        Alert.alert("Cannot Post", "Comment cannot be empty");
        return;
      }
      
      // Post comment
      await postComment({
        songId,
        text: validatedText,
      });
      
      // Clear input
      setInputText("");
      
      // Scroll to top to see new comment
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 200);
      
      // Refresh comments
      refetch();
      
      triggerHaptic("success");
      
    } catch (error) {
      const mavinError = errorFromUnknown(error);
      
      if (mavinError.message.includes("empty")) {
        Alert.alert("Cannot Post", "Comment cannot be empty");
      } else if (mavinError.message.includes("too long")) {
        Alert.alert("Cannot Post", "Comment is too long (max 500 characters)");
      } else if (mavinError.message.includes("rate limit")) {
        Alert.alert("Slow Down", "Please wait a moment before posting again.");
      } else {
        Alert.alert("Failed to Post", "Please check your connection and try again.");
      }
      
      triggerHaptic("error");
      
    } finally {
      setIsPosting(false);
    }
  }, [songId, inputText, postComment, refetch]);

  // ==========================================================================
  // HANDLE DELETE COMMENT — Client Action
  // ==========================================================================
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!songId) return;
    
    try {
      triggerHaptic("medium");
      await deleteComment({ songId, commentId });
      
      // Optimistic update
      setLocalComments(prev => prev.filter(c => c.id !== commentId));
      
      // Refresh from server
      refetch();
      
    } catch (error) {
      // Revert optimistic update on error
      refetch();
      Alert.alert("Failed to Delete", "Please try again later.");
      triggerHaptic("error");
    }
  }, [songId, deleteComment, refetch]);

  // ==========================================================================
  // HANDLE LIKE COMMENT — Client Action
  // ==========================================================================
  const handleLikeComment = useCallback(async (commentId: string) => {
    if (!songId) return;
    
    try {
      await likeComment({ songId, commentId });
      // Optimistic update handled in component state
    } catch (error) {
      // Silent fail — like is non-critical
      console.log("Failed to like comment");
    }
  }, [songId, likeComment]);

  // ==========================================================================
  // RENDER COMMENT ITEM
  // ==========================================================================
  const renderCommentItem = useCallback(({ item }: { item: CommentItemData }) => (
    <CommentItem 
      comment={item} 
      isOwnComment={item.isOwn}
      onDelete={item.isOwn ? handleDeleteComment : undefined}
      onLike={handleLikeComment}
    />
  ), [handleDeleteComment, handleLikeComment]);

  // ==========================================================================
  // RENDER EMPTY STATE — Client Friendly
  // ==========================================================================
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons 
        name="comment-text-outline" 
        size={moderateScale(64)} 
        color="rgba(255,255,255,0.2)" 
      />
      <Text style={styles.emptyTitle}>No comments yet</Text>
      <Text style={styles.emptyText}>
        Be the first to share your thoughts!
      </Text>
    </View>
  ), []);

  // ==========================================================================
  // RENDER HEADER — Simple Count, No Analytics
  // ==========================================================================
  const renderHeader = useCallback(() => (
    <View style={styles.statsHeader}>
      <View style={styles.statsBadge}>
        <MaterialCommunityIcons name="comment-text" size={moderateScale(14)} color={Colors.primary} />
        <Text style={styles.statsText}>
          {localComments.length} {localComments.length === 1 ? 'Comment' : 'Comments'}
        </Text>
      </View>
    </View>
  ), [localComments.length]);

  // ==========================================================================
  // ERROR STATE — Client Friendly
  // ==========================================================================
  if (error && !isInitialLoad) {
    return (
      <View style={[defaultStyles.container, styles.errorContainer]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MaterialCommunityIcons 
          name="alert-circle-outline" 
          size={moderateScale(64)} 
          color="rgba(255,255,255,0.3)" 
        />
        <Text style={styles.errorTitle}>Unable to Load Comments</Text>
        <Text style={styles.errorText}>
          Please check your connection
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            triggerHaptic("light");
            refetch();
          }}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================
  if (isLoading && isInitialLoad) {
    return (
      <View style={[defaultStyles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading comments...</Text>
      </View>
    );
  }

  // ==========================================================================
  // MAIN RENDER — CLIENT-ONLY INTERFACE
  // ==========================================================================
  return (
    <View style={[defaultStyles.container, styles.container]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* HEADER — Simple, No Analytics */}
      <BlurView 
        intensity={80} 
        tint="dark" 
        style={[styles.header, { paddingTop: top + verticalScale(8) }]}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            triggerHaptic("light");
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-down" size={moderateScale(24)} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Comments</Text>
        </View>
        
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => {
            triggerHaptic("light");
            refetch();
          }}
          disabled={isRefetching}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons 
            name={isRefetching ? "refresh-outline" : "refresh"} 
            size={moderateScale(20)} 
            color={isRefetching ? "rgba(255,255,255,0.5)" : "#fff"} 
          />
        </TouchableOpacity>
      </BlurView>

      {/* COMMENTS LIST — Pure Display */}
      <FlatList
        ref={flatListRef}
        data={localComments}
        renderItem={renderCommentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottom + verticalScale(100) }
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        ListFooterComponent={() => (
          <View style={styles.listFooter}>
            {isRefetching && (
              <ActivityIndicator color={Colors.primary} size="small" />
            )}
          </View>
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* COMMENT INPUT — Client Action */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputKeyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <BlurView intensity={90} tint="dark" style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <View style={styles.inputAvatar}>
              <MaterialCommunityIcons 
                name="account-circle" 
                size={moderateScale(32)} 
                color={isPremium ? Colors.primary : "rgba(255,255,255,0.3)"} 
              />
            </View>
            
            <View style={styles.inputFieldContainer}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                placeholder={isPremium || gracePeriodStatus === 'grace_period' 
                  ? "Add a comment..." 
                  : "Join the conversation"
                }
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!isPostingComment}
                onSubmitEditing={handlePostComment}
                returnKeyType="send"
              />
              
              <View style={styles.inputActions}>
                <Text style={styles.charCounter}>
                  {inputText.length}/500
                </Text>
                
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
                    <Ionicons name="send" size={moderateScale(16)} color="#000" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          
          {/* Simple prompt for non-premium users */}
          {!(isPremium || gracePeriodStatus === 'grace_period') && (
            <View style={styles.guestPrompt}>
              <Text style={styles.guestText}>
                Everyone can comment — no sign-in required
              </Text>
            </View>
          )}
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================================
// CLIENT-ONLY STYLES
// Clean, simple, no admin/creator UI elements
// ============================================================================
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: Colors.text,
    fontSize: moderateScale(16),
    marginTop: verticalScale(16),
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: scale(40),
  },
  errorTitle: {
    color: "#fff",
    fontSize: moderateScale(20),
    fontWeight: "700",
    marginTop: verticalScale(24),
    textAlign: "center",
  },
  errorText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: moderateScale(14),
    textAlign: "center",
    marginTop: verticalScale(8),
    marginBottom: verticalScale(24),
    lineHeight: moderateScale(20),
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: scale(32),
    paddingVertical: verticalScale(12),
    borderRadius: scale(24),
  },
  retryButtonText: {
    color: "#000",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(40),
    paddingVertical: verticalScale(60),
  },
  emptyTitle: {
    color: "#fff",
    fontSize: moderateScale(18),
    fontWeight: "600",
    marginTop: verticalScale(16),
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: moderateScale(14),
    textAlign: "center",
    marginTop: verticalScale(8),
    lineHeight: moderateScale(20),
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(12),
    zIndex: 100,
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
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  headerAction: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  statsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  statsText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: moderateScale(13),
    fontWeight: "500",
  },
  listContent: {
    paddingTop: verticalScale(80),
  },
  commentItem: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(8),
  },
  commentAuthorSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  commentAvatar: {
    marginRight: scale(12),
  },
  commentAuthor: {
    color: "#fff",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginBottom: verticalScale(2),
  },
  ownCommentAuthor: {
    color: Colors.primary,
  },
  commentTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: moderateScale(11),
  },
  commentText: {
    color: "#fff",
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(12),
    paddingLeft: scale(44),
  },
  commentFooter: {
    paddingLeft: scale(44),
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(20),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  actionText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: moderateScale(12),
  },
  listFooter: {
    paddingVertical: verticalScale(20),
    alignItems: "center",
  },
  inputKeyboardView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(8),
  },
  inputWrapper: {
    flexDirection: "row",
    paddingHorizontal: scale(16),
    gap: scale(12),
  },
  inputAvatar: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  inputFieldContainer: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  textInput: {
    color: "#fff",
    fontSize: moderateScale(14),
    maxHeight: verticalScale(80),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
  },
  inputActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(4),
  },
  charCounter: {
    color: "rgba(255,255,255,0.4)",
    fontSize: moderateScale(11),
  },
  sendButton: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(212, 175, 55, 0.3)",
  },
  guestPrompt: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(8),
    paddingVertical: verticalScale(6),
    marginHorizontal: scale(16),
  },
  guestText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: moderateScale(11),
    fontStyle: "italic",
  },
});